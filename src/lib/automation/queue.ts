// The run queue lives in the runs table: status "queued" with a position. Only the worker starts runs.

import { and, asc, eq, inArray, lt, max, sql } from "drizzle-orm";

import { type Db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import type { RunOptions } from "./types";

export const MAX_QUEUE = 10;
export const MAX_WAIT_HOURS = 8;

export class QueueError extends Error {}

/** Two runs are the same when they would run the same tests the same way. */
export function sameTests(a: RunOptions, b: RunOptions): boolean {
  const key = (o: RunOptions) => JSON.stringify([o.target, o.testSet, o.includeCostly]);
  return key(a) === key(b);
}

export async function enqueue(
  db: Db,
  input: {
    name: string;
    trigger: "on_demand" | "scheduled";
    options: RunOptions;
    scheduleId?: string;
    suiteId?: string;
    rerunOf?: string;
    createdBy?: string;
  },
): Promise<{ id: string; position: number; runningNow: boolean }> {
  return db.transaction(async (tx) => {
    // Serialise enqueues, so two clicks at the same moment cannot both pass the duplicate check.
    await tx.execute(sql`select pg_advisory_xact_lock(4242)`);
    const active = await tx
      .select()
      .from(schema.runs)
      .where(inArray(schema.runs.status, ["queued", "running"]));
    const running = active.find((run) => run.status === "running");
    if (running && sameTests(running.options, input.options)) throw new QueueError("These tests are running right now.");
    const queued = active.filter((run) => run.status === "queued");
    if (queued.some((run) => sameTests(run.options, input.options))) throw new QueueError("These tests are already in the queue.");
    if (queued.length >= MAX_QUEUE) throw new QueueError(`The queue is full (${MAX_QUEUE} runs). Cancel one first.`);

    const [{ last }] = await tx.select({ last: max(schema.runs.queuePosition) }).from(schema.runs).where(eq(schema.runs.status, "queued"));
    const position = (last ?? 0) + 1;
    const id = newId("run");
    await tx.insert(schema.runs).values({
      id,
      name: input.name,
      status: "queued",
      trigger: input.trigger,
      options: input.options,
      scheduleId: input.scheduleId,
      suiteId: input.suiteId,
      rerunOf: input.rerunOf,
      createdBy: input.createdBy,
      queuePosition: position,
    });
    return { id, position: queued.length + 1, runningNow: Boolean(running) };
  });
}

export async function queuedRuns(db: Db) {
  return db.select().from(schema.runs).where(eq(schema.runs.status, "queued")).orderBy(asc(schema.runs.queuePosition));
}

export async function moveToTop(db: Db, runId: string): Promise<void> {
  const [first] = await queuedRuns(db);
  if (!first || first.id === runId) return;
  await db
    .update(schema.runs)
    .set({ queuePosition: (first.queuePosition ?? 1) - 1 })
    .where(and(eq(schema.runs.id, runId), eq(schema.runs.status, "queued")));
}

export async function cancelQueued(db: Db, runId?: string): Promise<number> {
  const where = runId
    ? and(eq(schema.runs.status, "queued"), eq(schema.runs.id, runId))
    : eq(schema.runs.status, "queued");
  const cancelled = await db
    .update(schema.runs)
    .set({ status: "stopped", queuePosition: null, errorMessage: "Cancelled before it started.", finishedAt: new Date() })
    .where(where)
    .returning({ id: schema.runs.id });
  return cancelled.length;
}

/** Runs that waited too long are dropped: the data on the platform has moved on by then. */
export async function dropStale(db: Db, now = new Date()): Promise<number> {
  const limit = new Date(now.getTime() - MAX_WAIT_HOURS * 3_600_000);
  const dropped = await db
    .update(schema.runs)
    .set({ status: "stopped", queuePosition: null, errorMessage: `Waited more than ${MAX_WAIT_HOURS} hours in the queue.`, finishedAt: now })
    .where(and(eq(schema.runs.status, "queued"), lt(schema.runs.queuedAt, limit)))
    .returning({ id: schema.runs.id });
  return dropped.length;
}
