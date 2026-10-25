import { and, asc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { computeOverview, type OverviewRun } from "@/lib/automation/overview";
import { json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

const Query = z.object({ days: z.enum(["7", "30"]).default("7") });

export const GET = route(async (request: Request) => {
  await requireApi("automation");
  const days = Number(Query.parse(Object.fromEntries(new URL(request.url).searchParams)).days);
  const now = new Date();
  // Twice the period for the comparison, and at least 30 days for the flaky list.
  const since = new Date(now.getTime() - Math.max(2 * days, 30) * 86_400_000);
  const runRows = await db
    .select({
      id: schema.runs.id,
      number: schema.runs.number,
      finishedAt: schema.runs.finishedAt,
      total: schema.runs.total,
      passed: schema.runs.passed,
      flaky: schema.runs.flaky,
      skipped: schema.runs.skipped,
    })
    .from(schema.runs)
    .where(and(inArray(schema.runs.status, ["passed", "failed"]), isNotNull(schema.runs.finishedAt), gte(schema.runs.finishedAt, since)));
  const runs = runRows as OverviewRun[];
  const tests = runs.length
    ? await db
        .select({
          runId: schema.runTests.runId,
          nodeid: schema.runTests.nodeid,
          module: schema.runTests.module,
          title: schema.runTests.title,
          testCaseId: schema.runTests.testCaseId,
          outcome: schema.runTests.outcome,
          failureType: schema.runTests.failureType,
          failingSince: schema.runTests.failingSince,
          culprits: schema.runTests.culprits,
        })
        .from(schema.runTests)
        .where(inArray(schema.runTests.runId, runs.map((run) => run.id)))
    : [];

  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const upcoming = await db
    .select({ id: schema.schedules.id, name: schema.schedules.name, nextRunAt: schema.schedules.nextRunAt })
    .from(schema.schedules)
    .where(and(eq(schema.schedules.paused, false), isNotNull(schema.schedules.nextRunAt)))
    .orderBy(asc(schema.schedules.nextRunAt));

  return json({
    ...computeOverview(runs, tests, days, now),
    nextRuns: upcoming
      .filter((s) => s.nextRunAt! <= weekEnd)
      .map((s) => ({ id: s.id, name: s.name, at: s.nextRunAt!.toISOString() })),
  });
});
