// Runs one queued run: environment check, pytest in the QA repo, live progress, results.

import { type ChildProcess, execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { and, eq } from "drizzle-orm";

import { resolveTests } from "@/lib/automation/catalog";
import { displayCommand, pytestArgs } from "@/lib/automation/command";
import { failureTypeOf } from "@/lib/automation/failure";
import { readCatalog } from "@/lib/automation/state";
import type { RunOptions, RunProgress, SelectionItem, TestMedia, TestOutcome, TestStep } from "@/lib/automation/types";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { checkEnvironment } from "./environment";
import { analyseFailure } from "./insight";
import { acquireLock, releaseLock } from "./lock";
import { notifyRunFinished } from "./notify";

type Run = typeof schema.runs.$inferSelect;

type ReportResult = {
  nodeid: string;
  file: string;
  module: string;
  feature: string;
  role: string;
  testCaseId: string | null;
  title: string;
  markers: string[];
  knownBug: string | null;
  outcome: "passed" | "failed" | "skipped" | "flaky";
  attempts?: number;
  durationMs: number;
  errorType?: string;
  errorMessage?: string;
  phase?: string;
  steps?: TestStep[];
  media?: TestMedia;
};

export function runDir(runId: string): string {
  return path.join(env.storageDir, "runs", runId);
}

type Current = { run: Run; child: ChildProcess; dir: string; offset: number; progress: RunProgress; stopping: boolean };

export class Runner {
  private current: Current | null = null;

  get busy(): boolean {
    return this.current !== null;
  }

  /** Starts a queued run. Returns false when the lock is held by another worker. */
  async start(run: Run): Promise<boolean> {
    if (!acquireLock(run.id)) return false;
    const startedAt = new Date();
    const claimed = await db
      .update(schema.runs)
      .set({ status: "running", queuePosition: null, startedAt, progress: { total: 0, done: 0, passed: 0, failed: 0, skipped: 0 } })
      .where(and(eq(schema.runs.id, run.id), eq(schema.runs.status, "queued")))
      .returning();
    if (claimed.length === 0) {
      releaseLock();
      return true; // cancelled in the meantime
    }
    try {
      await this.launch({ ...claimed[0] });
    } catch (error) {
      await this.finish(run.id, { status: "error", errorMessage: (error as Error).message });
    }
    return true;
  }

  private async launch(run: Run): Promise<void> {
    const report = await checkEnvironment();
    await db
      .update(schema.runs)
      .set({ environmentReport: report, platformCommit: report.commit ?? null })
      .where(eq(schema.runs.id, run.id));
    if (!report.reachable || !report.ready) {
      await this.finish(run.id, { status: "not_ready", errorMessage: report.warnings[0] ?? "DriveNow is not ready." });
      return;
    }

    const catalog = await readCatalog(db);
    const { selection, exclude } = await selectionFor(run.options);
    const tests = resolveTests(catalog.tests, selection, { exclude, testSet: run.options.testSet, includeCostly: run.options.includeCostly });
    if (tests.length === 0) {
      const message = selection.length ? "No tests match: they are smoke only, need LLM credits, or no longer exist." : "Tests no longer available.";
      await this.finish(run.id, { status: "error", errorMessage: message });
      return;
    }

    const dir = runDir(run.id);
    fs.mkdirSync(dir, { recursive: true });
    const args = pytestArgs({
      selection,
      exclude,
      testSet: run.options.testSet,
      includeCostly: run.options.includeCostly,
      testCount: tests.length,
      watch: run.options.watch,
      headed: run.options.headed,
      retries: run.options.retries,
    });
    const internal = ["-p", "no:randomly", `--dashboard-dir=${dir}`, `--output=${path.join(dir, "artifacts")}`];
    const log = fs.openSync(path.join(dir, "output.log"), "w");
    const child = spawn(env.qaPython, ["-m", "pytest", ...args, ...internal], {
      cwd: env.qaRepo,
      env: { ...process.env, BASE_URL: env.platformUrl, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      stdio: ["ignore", log, log],
      windowsHide: true,
      // its own process group on Linux and macOS, so Stop can end pytest with its workers and browsers
      detached: process.platform !== "win32",
    });
    const progress: RunProgress = { total: tests.length, done: 0, passed: 0, failed: 0, skipped: 0, pid: child.pid };
    this.current = { run, child, dir, offset: 0, progress, stopping: false };
    await db
      .update(schema.runs)
      .set({ command: displayCommand(args), total: tests.length, progress })
      .where(eq(schema.runs.id, run.id));
    console.log(`[run] ${run.id} started: ${displayCommand(args)}`);

    child.on("exit", (code) => {
      fs.closeSync(log);
      void this.complete(code ?? -1);
    });
    child.on("error", (error) => {
      void this.finish(run.id, { status: "error", errorMessage: `Could not start pytest: ${error.message}` });
    });
  }

  /** Called every tick: reads new progress lines and honours a Stop request. */
  async poll(): Promise<void> {
    const current = this.current;
    if (!current) return;
    const file = path.join(current.dir, "progress.jsonl");
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");
      const fresh = content.slice(current.offset);
      const lastNewline = fresh.lastIndexOf("\n");
      if (lastNewline >= 0) {
        current.offset += lastNewline + 1;
        for (const line of fresh.slice(0, lastNewline).split("\n")) applyEvent(current.progress, line);
        await db.update(schema.runs).set({ progress: { ...current.progress } }).where(eq(schema.runs.id, current.run.id));
      }
    }
    const row = await db.query.runs.findFirst({ where: eq(schema.runs.id, current.run.id), columns: { stopRequested: true } });
    if (row?.stopRequested && !current.stopping) {
      current.stopping = true;
      killTree(current.child.pid);
    }
  }

  private async complete(exitCode: number): Promise<void> {
    const current = this.current;
    if (!current) return;
    await this.poll();
    const reportFile = path.join(current.dir, "report.json");
    const results: ReportResult[] = fs.existsSync(reportFile)
      ? (JSON.parse(fs.readFileSync(reportFile, "utf8")) as { results: ReportResult[] }).results
      : [];
    const startedAt = current.run.startedAt ?? new Date();
    const fresh = await db.query.runs.findFirst({ where: eq(schema.runs.id, current.run.id) });
    const commit = fresh?.platformCommit ?? undefined;

    const rows: (typeof schema.runTests.$inferInsert & { outcome: TestOutcome })[] = [];
    for (const result of results) {
      const failed = result.outcome === "failed";
      const outcome: TestOutcome = failed && result.knownBug ? "known_bug" : result.outcome;
      const failureType = failed ? failureTypeOf({ knownBug: result.knownBug, errorType: result.errorType ?? null }) : null;
      const insight = failed ? await analyseFailure(result.nodeid, startedAt, commit) : null;
      rows.push({
        runId: current.run.id,
        nodeid: result.nodeid,
        testCaseId: result.testCaseId,
        title: result.title,
        module: result.module,
        feature: result.feature,
        role: result.role,
        file: result.file,
        markers: result.markers,
        outcome,
        attempts: result.attempts ?? 1,
        durationMs: result.durationMs,
        errorType: result.errorType ?? null,
        errorMessage: result.errorMessage ?? null,
        failureType,
        knownBug: result.knownBug,
        failingSince: insight?.failingSince ?? null,
        culprits: insight?.culprits ?? null,
        steps: result.steps ?? null,
        media: result.media ?? null,
        isSetup: result.phase === "setup",
      });
    }
    if (rows.length) await db.insert(schema.runTests).values(rows);

    const count = (outcome: TestOutcome) => rows.filter((row) => row.outcome === outcome).length;
    const totals = {
      total: rows.length,
      passed: count("passed"),
      flaky: count("flaky"),
      failed: count("failed"),
      knownBug: count("known_bug"),
      skipped: count("skipped"),
    };
    let status: Run["status"] = totals.failed > 0 ? "failed" : "passed";
    let errorMessage: string | null = null;
    if (current.stopping) status = "stopped";
    else if (rows.length === 0) {
      status = "error";
      errorMessage = `pytest ended with exit code ${exitCode} before running any test. See the terminal output.`;
    }
    await this.finish(current.run.id, { status, errorMessage, ...totals });
  }

  private async finish(runId: string, values: Partial<Run>): Promise<void> {
    const finishedAt = new Date();
    const [run] = await db
      .update(schema.runs)
      .set({ ...values, finishedAt, stopRequested: false })
      .where(eq(schema.runs.id, runId))
      .returning();
    this.current = null;
    releaseLock();
    console.log(`[run] ${runId} finished: ${values.status}`);
    if (run) await notifyRunFinished(run).catch((error: unknown) => console.error("[teams]", (error as Error).message));
  }
}

/** The selection of a run: its own, or the items of its suite. */
async function selectionFor(options: RunOptions): Promise<{ selection: SelectionItem[]; exclude: string[] }> {
  if (options.target.kind === "tests") return { selection: options.target.selection, exclude: [] };
  const suite = await db.query.suites.findFirst({ where: eq(schema.suites.id, options.target.suiteId) });
  return suite ? { selection: suite.items.include, exclude: suite.items.exclude } : { selection: [], exclude: [] };
}

function applyEvent(progress: RunProgress, line: string): void {
  let event: { event: string; total?: number; nodeid?: string; outcome?: string };
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }
  if (event.event === "start" && event.total !== undefined) progress.total = event.total;
  if (event.event === "test_start") progress.current = event.nodeid;
  if (event.event === "test_end") {
    progress.done += 1;
    if (event.outcome === "passed" || event.outcome === "flaky") progress.passed += 1;
    else if (event.outcome === "skipped") progress.skipped += 1;
    else progress.failed += 1;
  }
}

/** Stops pytest with every process it started (xdist workers, browsers). */
function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === "win32") execFile("taskkill", ["/pid", String(pid), "/t", "/f"], () => undefined);
  else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      process.kill(pid, "SIGTERM");
    }
  }
}
