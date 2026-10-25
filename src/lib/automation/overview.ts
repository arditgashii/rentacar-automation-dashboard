// The numbers of the Overview page, computed from finished runs and their test results. Pure.

import { label } from "./catalog";
import type { CulpritCommit, FailureType, TestOutcome } from "./types";

export type OverviewRun = { id: string; number: number; finishedAt: Date; total: number; passed: number; flaky: number; skipped: number };
export type OverviewTest = {
  runId: string;
  nodeid: string;
  module: string;
  title: string;
  testCaseId: string | null;
  outcome: TestOutcome;
  failureType: FailureType | null;
  failingSince: Date | null;
  culprits: CulpritCommit[] | null;
};

export type Overview = {
  days: number;
  passRate: number | null;
  passRateChange: number | null;
  runs: number;
  failingNow: number;
  flakyCount: number;
  daily: { date: string; rate: number | null; runs: number }[];
  modules: { module: string; label: string; rate: number | null; passed: number; checked: number }[];
  attention: {
    nodeid: string;
    title: string;
    testCaseId: string | null;
    since: string;
    failureType: FailureType | null;
    culprits: CulpritCommit[];
    runId: string;
    runNumber: number;
  }[];
  flaky: { nodeid: string; title: string; testCaseId: string | null; notClean: number; runs: number }[];
};

const DAY = 86_400_000;
const CLEAN: TestOutcome[] = ["passed"];
const NOT_CLEAN: TestOutcome[] = ["failed", "flaky", "known_bug"];

/** Passed (flaky counts as passed) out of the tests that were checked (skipped tests are left out). */
function rate(runs: OverviewRun[]): number | null {
  const checked = runs.reduce((sum, run) => sum + run.total - run.skipped, 0);
  const passed = runs.reduce((sum, run) => sum + run.passed + run.flaky, 0);
  return checked ? Math.round((passed / checked) * 1000) / 10 : null;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function computeOverview(allRuns: OverviewRun[], tests: OverviewTest[], days: number, now: Date): Overview {
  const start = new Date(now.getTime() - days * DAY);
  const previousStart = new Date(now.getTime() - 2 * days * DAY);
  const runs = allRuns.filter((run) => run.finishedAt >= start);
  const previous = allRuns.filter((run) => run.finishedAt >= previousStart && run.finishedAt < start);
  const passRate = rate(runs);
  const previousRate = rate(previous);
  const runIds = new Set(runs.map((run) => run.id));
  const runById = new Map(allRuns.map((run) => [run.id, run]));
  const periodTests = tests.filter((test) => runIds.has(test.runId));

  // Pass rate per day; a day without runs stays empty so the chart shows a gap.
  const daily: Overview["daily"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * DAY);
    const dayRuns = runs.filter((run) => dayKey(run.finishedAt) === dayKey(date));
    daily.push({ date: dayKey(date), rate: rate(dayRuns), runs: dayRuns.length });
  }

  const modules = [...new Set(periodTests.map((t) => t.module))].map((module) => {
    const results = periodTests.filter((t) => t.module === module && t.outcome !== "skipped");
    const passed = results.filter((t) => t.outcome === "passed" || t.outcome === "flaky").length;
    return { module, label: label(module), rate: results.length ? Math.round((passed / results.length) * 1000) / 10 : null, passed, checked: results.length };
  });
  modules.sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.label.localeCompare(b.label));

  // The latest result of every test, newest run first.
  const byTest = new Map<string, OverviewTest[]>();
  const ordered = [...tests].sort((a, b) => (runById.get(b.runId)?.finishedAt.getTime() ?? 0) - (runById.get(a.runId)?.finishedAt.getTime() ?? 0));
  for (const test of ordered) byTest.set(test.nodeid, [...(byTest.get(test.nodeid) ?? []), test]);

  const attention: Overview["attention"] = [];
  const flaky: Overview["flaky"] = [];
  for (const [nodeid, history] of byTest) {
    const latest = history[0];
    if (latest.outcome === "failed" || latest.outcome === "known_bug") {
      const run = runById.get(latest.runId)!;
      attention.push({
        nodeid,
        title: latest.title,
        testCaseId: latest.testCaseId,
        since: (latest.failingSince ?? run.finishedAt).toISOString(),
        failureType: latest.failureType,
        culprits: latest.culprits ?? [],
        runId: latest.runId,
        runNumber: run.number,
      });
    }
    const recent = history.filter((t) => (runById.get(t.runId)?.finishedAt ?? now) >= new Date(now.getTime() - 30 * DAY));
    const notClean = recent.filter((t) => NOT_CLEAN.includes(t.outcome)).length;
    const clean = recent.filter((t) => CLEAN.includes(t.outcome)).length;
    // Flaky: it passed on a retry, or it both passed and failed in the last 30 days.
    if (recent.some((t) => t.outcome === "flaky") || (notClean > 0 && clean > 0)) {
      flaky.push({ nodeid, title: latest.title, testCaseId: latest.testCaseId, notClean, runs: recent.length });
    }
  }
  attention.sort((a, b) => a.since.localeCompare(b.since));
  flaky.sort((a, b) => b.notClean / b.runs - a.notClean / a.runs);

  return {
    days,
    passRate,
    passRateChange: passRate !== null && previousRate !== null ? Math.round((passRate - previousRate) * 10) / 10 : null,
    runs: runs.length,
    failingNow: attention.length,
    flakyCount: flaky.length,
    daily,
    modules,
    attention,
    flaky,
  };
}
