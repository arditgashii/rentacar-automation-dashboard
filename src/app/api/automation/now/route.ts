import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { cardsFor } from "@/lib/automation/runs-data";
import { readCatalog, readState, WORKER_STALE_MS } from "@/lib/automation/state";
import { json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

/** The "Now" panel: what runs, what waits, the next schedule and what needs attention. */
export const GET = route(async () => {
  await requireApi("automation");
  const active = await db
    .select()
    .from(schema.runs)
    .where(inArray(schema.runs.status, ["running", "queued"]))
    .orderBy(asc(schema.runs.queuePosition));
  const cards = await cardsFor(db, active);
  const running = cards.find((card) => card.status === "running") ?? null;
  const catalog = running?.progress?.current ? await readCatalog(db) : null;
  const currentTitle = catalog?.tests.find((t) => t.nodeid === running?.progress?.current)?.title ?? null;

  const next = await db.query.schedules.findFirst({
    where: and(eq(schema.schedules.paused, false), isNotNull(schema.schedules.nextRunAt)),
    orderBy: asc(schema.schedules.nextRunAt),
  });

  const lastFinished = await db.query.runs.findFirst({
    where: inArray(schema.runs.status, ["passed", "failed"]),
    orderBy: desc(schema.runs.finishedAt),
  });
  const attention = lastFinished
    ? await db
        .select({ nodeid: schema.runTests.nodeid, title: schema.runTests.title, testCaseId: schema.runTests.testCaseId })
        .from(schema.runTests)
        .where(and(eq(schema.runTests.runId, lastFinished.id), eq(schema.runTests.outcome, "failed")))
        .limit(5)
    : [];

  const worker = await readState<{ at: string }>(db, "worker");
  return json({
    running: running ? { ...running, currentTitle } : null,
    queue: cards.filter((card) => card.status === "queued"),
    nextRun: next ? { id: next.id, name: next.name, at: next.nextRunAt!.toISOString() } : null,
    attention: { runId: lastFinished?.id ?? null, runNumber: lastFinished?.number ?? null, tests: attention },
    workerAlive: worker ? Date.now() - new Date(worker.at).getTime() < WORKER_STALE_MS : false,
  });
});
