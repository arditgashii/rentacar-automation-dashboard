// Demo data for Automation Tests: Teams channels (pointing to the local mock), suites, schedules and
// 30 days of run history built from the real test catalog and the real platform commits.
// Every generated run has source = "seed".

import { execFileSync } from "node:child_process";

import { desc, eq } from "drizzle-orm";

import { firstSlot } from "@/lib/automation/schedules-data";
import { readCatalog } from "@/lib/automation/state";
import type { CatalogTest, CulpritCommit, RunOptions, SelectionItem, TestOutcome } from "@/lib/automation/types";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";
import { refreshCatalog } from "@/worker/catalog";

const DAY = 86_400_000;

/** A small seeded random generator, so the demo history is the same on every machine. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function platformCommits(): { sha: string; message: string; author: string; date: string }[] {
  try {
    const out = execFileSync("git", ["-C", env.platformRepo, "log", "--reverse", "--format=%H%x1f%s%x1f%an%x1f%aI"], { encoding: "utf8" });
    return out
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, message, author, date] = line.split("\x1f");
        return { sha, message, author, date };
      });
  } catch {
    return [];
  }
}

function at(daysAgo: number, hours: number, minutes: number, now: Date): Date {
  const date = new Date(now.getTime() - daysAgo * DAY);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const ALL_MODULES = (tests: CatalogTest[]): SelectionItem[] =>
  [...new Set(tests.map((t) => t.module))].map((module) => ({ kind: "module", module }));

export async function seedAutomation(adminId: string): Promise<void> {
  let catalog = await readCatalog(db);
  if (catalog.tests.length === 0) {
    await refreshCatalog(true);
    catalog = await readCatalog(db);
  }
  const tests = catalog.tests;
  if (tests.length === 0) throw new Error("The test catalog is empty: check QA_REPO_PATH and QA_PYTHON in .env.");

  // Teams channels point at the mock receiver (npm run teams:mock)
  const results = { id: newId("chn"), name: "QA results", webhookUrl: "http://localhost:3999/qa-results" };
  const bugs = { id: newId("chn"), name: "QA bug reports", webhookUrl: "http://localhost:3999/qa-bugs" };
  await db.insert(schema.teamsChannels).values([results, bugs]);
  await db.insert(schema.teamsSettings).values({ id: 1, twoChannels: true, resultsChannelId: results.id, bugsChannelId: bugs.id });

  // Suites
  const fleetSuite = { id: newId("ste"), name: "Fleet regression", description: "Everything about cars: create, update, search, delete.", items: { include: [{ kind: "module", module: "fleet" }] as SelectionItem[], exclude: [] }, createdBy: adminId };
  const securityFiles = tests.filter((t) => ["TC-002", "TC-003", "TC-009", "TC-012"].includes(t.testCaseId ?? ""));
  const securitySuite = {
    id: newId("ste"),
    name: "Login and security",
    description: "Sessions, access rules and refused actions.",
    items: { include: securityFiles.map((t): SelectionItem => ({ kind: "file", file: t.file })), exclude: [] },
    createdBy: adminId,
  };
  await db.insert(schema.suites).values([fleetSuite, securitySuite]);

  // Schedules
  const smoke = { repeat: "weekdays" as const, days: [], time: "07:00" };
  const nightly = { repeat: "daily" as const, days: [], time: "22:00" };
  const weekly = { repeat: "weekly" as const, days: [], time: "09:00" };
  const schedules = [
    { id: newId("sch"), name: "Weekday smoke", target: { target: { kind: "tests" as const, selection: ALL_MODULES(tests) }, testSet: "smoke" as const, includeCostly: false }, ...smoke, teamsChannelId: results.id, teamsMode: "failures" as const, teamsBugReports: false },
    { id: newId("sch"), name: "Nightly full", target: { target: { kind: "tests" as const, selection: ALL_MODULES(tests) }, testSet: "full" as const, includeCostly: false }, ...nightly, teamsChannelId: results.id, teamsMode: "every" as const, teamsBugReports: true },
    { id: newId("sch"), name: "Fleet weekly", target: { target: { kind: "suite" as const, suiteId: fleetSuite.id, suiteName: fleetSuite.name }, testSet: "full" as const, includeCostly: false }, ...weekly, teamsChannelId: null, teamsMode: "every" as const, teamsBugReports: false },
  ];
  await db.insert(schema.schedules).values(schedules.map((s) => ({ ...s, nextRunAt: firstSlot(s), createdBy: adminId })));

  await seedHistory(tests, schedules, adminId);
}

async function seedHistory(tests: CatalogTest[], schedules: { id: string; name: string }[], adminId: string) {
  const rng = random(42);
  const now = new Date();
  const commits = platformCommits();
  const commitFor = (daysAgo: number) => commits[Math.min(commits.length - 1, Math.floor(((30 - daysAgo) / 30) * commits.length))];
  const lastPass = new Map<string, number>(); // nodeid -> commit index of the last pass
  const failingSince = new Map<string, Date>();
  const [weekdaySmoke, nightly] = schedules;

  type Plan = { when: Date; name: string; scheduleId: string | null; testSet: "smoke" | "full"; selection: SelectionItem[]; scheduled: boolean };
  const plans: Plan[] = [];
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const day = at(daysAgo, 7, 0, now);
    const weekday = day.getDay() !== 0 && day.getDay() !== 6;
    if (weekday) plans.push({ when: at(daysAgo, 7, 0, now), name: weekdaySmoke.name, scheduleId: weekdaySmoke.id, testSet: "smoke", selection: ALL_MODULES(tests), scheduled: true });
    if (rng() < 0.4 && daysAgo > 0) {
      const module = [...new Set(tests.map((t) => t.module))][Math.floor(rng() * 3) % 3];
      plans.push({ when: at(daysAgo, 13 + Math.floor(rng() * 4), Math.floor(rng() * 60), now), name: module.charAt(0).toUpperCase() + module.slice(1), scheduleId: null, testSet: "full", selection: [{ kind: "module", module }], scheduled: false });
    }
    if (daysAgo > 0) plans.push({ when: at(daysAgo, 22, 0, now), name: nightly.name, scheduleId: nightly.id, testSet: "full", selection: ALL_MODULES(tests), scheduled: true });
  }
  plans.sort((a, b) => a.when.getTime() - b.when.getTime());

  for (const plan of plans) {
    const daysAgo = Math.round((now.getTime() - plan.when.getTime()) / DAY);
    const commitIndex = Math.min(commits.length - 1, Math.floor(((30 - daysAgo) / 30) * commits.length));
    const commit = commitFor(daysAgo);
    const runId = newId("run");
    const options: RunOptions = { environment: "local", target: { kind: "tests", selection: plan.selection }, testSet: plan.testSet, includeCostly: false, headed: false, watch: false, retries: plan.scheduled ? 2 : 0 };
    const chosen = tests.filter((t) => plan.selection.some((s) => s.kind === "module" && s.module === t.module) && !t.markers.includes("costly") && (plan.testSet === "full" || t.markers.includes("smoke")));

    // One night the platform was down: the run never got past the environment check.
    if (daysAgo === 12 && plan.name === nightly.name) {
      await db.insert(schema.runs).values({
        id: runId, name: plan.name, status: "not_ready", trigger: "scheduled", options, scheduleId: plan.scheduleId, source: "seed",
        queuedAt: plan.when, startedAt: plan.when, finishedAt: new Date(plan.when.getTime() + 9000),
        errorMessage: "DriveNow does not answer at http://localhost:8000.",
        environmentReport: { checkedAt: plan.when.toISOString(), platformUrl: "http://localhost:8000", reachable: false, ready: false, checks: {}, accounts: [], notRun: [], warnings: ["DriveNow does not answer at http://localhost:8000."] },
      });
      continue;
    }

    const rows = chosen.map((test) => {
      let outcome: TestOutcome = "passed";
      let attempts = 1;
      let errorType: string | null = null;
      let errorMessage: string | null = null;
      let failureType: "product" | "test" | "environment" | "known_bug" | null = null;
      if (test.markers.includes("known_bug")) {
        outcome = "known_bug";
        failureType = "known_bug";
        errorType = "assertion";
        errorMessage = KNOWN_MESSAGES[test.testCaseId ?? ""] ?? "The known bug is still there.";
      } else if (test.testCaseId === "TC-004" && daysAgo >= 16 && daysAgo <= 18) {
        outcome = "failed";
        failureType = "product";
        errorType = "assertion";
        errorMessage = "/media/cars/31/0b8e.jpg is not in Blob Storage";
      } else if (test.testCaseId === "TC-001" && daysAgo === 9 && plan.scheduled) {
        outcome = "failed";
        failureType = "test";
        errorType = "timeout";
        errorMessage = "Locator expected to be visible: the stat tiles did not appear in 10000 ms";
      } else if (test.testCaseId === "TC-007" && plan.scheduled && rng() < 0.15) {
        outcome = "flaky";
        attempts = 2;
      }
      const failed = outcome === "failed" || outcome === "known_bug";
      if (failed && !failingSince.has(test.nodeid)) failingSince.set(test.nodeid, plan.when);
      if (!failed) failingSince.delete(test.nodeid);
      let culprits: CulpritCommit[] | null = null;
      if (failed && commits.length) {
        const from = lastPass.get(test.nodeid);
        culprits = from !== undefined && from < commitIndex
          ? commits.slice(from + 1, commitIndex + 1).reverse().slice(0, 5).map((c) => ({ ...c, url: `${env.platformGithubUrl}/commit/${c.sha}` }))
          : [];
      }
      if (!failed) lastPass.set(test.nodeid, commitIndex);
      return {
        runId, nodeid: test.nodeid, testCaseId: test.testCaseId, title: test.title, module: test.module, feature: test.feature,
        role: test.role, file: test.file, markers: test.markers, outcome, attempts,
        durationMs: Math.round(1500 + rng() * 6500), errorType, errorMessage, failureType, knownBug: test.knownBug,
        failingSince: failed ? (failingSince.get(test.nodeid) ?? plan.when) : null, culprits, steps: null, media: null,
      };
    });
    const count = (o: TestOutcome) => rows.filter((r) => r.outcome === o).length;
    const duration = Math.round(rows.reduce((sum, r) => sum + r.durationMs, 0) / 3) + 4000;
    await db.insert(schema.runs).values({
      id: runId, name: plan.name, status: count("failed") ? "failed" : "passed", trigger: plan.scheduled ? "scheduled" : "on_demand", options,
      scheduleId: plan.scheduleId, source: "seed", createdBy: plan.scheduled ? null : adminId,
      command: `pytest ${plan.selection.map((s) => (s.kind === "module" ? `tests/${s.module}` : "")).join(" ")} -m "${plan.testSet === "smoke" ? "smoke and " : ""}not costly" -n 3${plan.scheduled ? " --reruns 2" : ""}`,
      total: rows.length, passed: count("passed"), failed: count("failed"), flaky: count("flaky"), skipped: 0, knownBug: count("known_bug"),
      platformCommit: commit?.sha ?? null, queuedAt: plan.when, startedAt: plan.when, finishedAt: new Date(plan.when.getTime() + duration),
      environmentReport: { checkedAt: plan.when.toISOString(), platformUrl: "http://localhost:8000", reachable: true, ready: true, checks: { database: "ok", storage: "ok", bus: "ok" }, version: "1.0.0", commit: commit?.sha, accounts: [], notRun: [], warnings: [] },
    });
    if (rows.length) await db.insert(schema.runTests).values(rows);
  }
  for (const schedule of schedules) {
    const [last] = await db
      .select({ id: schema.runs.id })
      .from(schema.runs)
      .where(eq(schema.runs.scheduleId, schedule.id))
      .orderBy(desc(schema.runs.queuedAt))
      .limit(1);
    if (last) await db.update(schema.schedules).set({ lastRunId: last.id }).where(eq(schema.schedules.id, schedule.id));
  }
}

const KNOWN_MESSAGES: Record<string, string> = {
  "TC-005": "saved car differs from what the admin entered: daily_price: expected 89.99, got 89.0",
  "TC-006": "search results: expected ['SUV at exactly the max price', 'cheaper SUV'], got ['cheaper SUV']",
  "TC-008": "an overlapping booking was accepted: expected 409 DATES_TAKEN, got 201",
  "TC-009": "another client could delete the car: expected 403, got 204 and the car was deleted",
};
