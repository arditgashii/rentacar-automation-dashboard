// The QA Hub worker: owns the queue, the one-run-at-a-time lock, the scheduler, Teams messages, the
// morning summary, the test catalog and media retention. The web app only writes requests into the
// database and reads state. Start it with `npm run worker` (or `npm run dev:all`).

import { asc, eq } from "drizzle-orm";

import { dropStale } from "@/lib/automation/queue";
import { writeState } from "@/lib/automation/state";
import { db, schema } from "@/lib/db";
import { refreshCatalog } from "./catalog";
import { releaseLock } from "./lock";
import { sendMorningSummary } from "./notify";
import { deleteOldMedia } from "./retention";
import { Runner } from "./runner";
import { startDueSchedules } from "./scheduler";

const TICK_MS = 2_000;
const runner = new Runner();
const last = { catalog: 0, schedules: 0, morning: 0, retention: 0 };

function every(key: keyof typeof last, ms: number, now: number): boolean {
  if (now - last[key] < ms) return false;
  last[key] = now;
  return true;
}

/** A run that was "running" when the worker stopped can never finish; it is closed with a clear reason. */
async function closeAbandonedRuns(): Promise<void> {
  const abandoned = await db
    .update(schema.runs)
    .set({ status: "error", errorMessage: "The worker stopped while this run was running.", finishedAt: new Date() })
    .where(eq(schema.runs.status, "running"))
    .returning({ id: schema.runs.id });
  if (abandoned.length) console.log(`[worker] closed ${abandoned.length} abandoned run(s)`);
  releaseLock();
}

async function tick(): Promise<void> {
  const now = Date.now();
  await writeState(db, "worker", { at: new Date(now).toISOString(), pid: process.pid });
  if (every("catalog", 30_000, now)) await refreshCatalog();
  if (every("schedules", 10_000, now)) await startDueSchedules(new Date(now));
  if (every("morning", 60_000, now)) await sendMorningSummary(new Date(now));
  if (every("retention", 3_600_000, now)) await deleteOldMedia(new Date(now));

  await runner.poll();
  if (!runner.busy) {
    await dropStale(db);
    const [next] = await db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.status, "queued"))
      .orderBy(asc(schema.runs.queuePosition))
      .limit(1);
    if (next) await runner.start(next);
  }
}

async function main(): Promise<void> {
  console.log("[worker] starting");
  await closeAbandonedRuns();
  await refreshCatalog(true);
  last.catalog = Date.now();
  for (;;) {
    try {
      await tick();
    } catch (error) {
      console.error("[worker]", error);
    }
    await new Promise((resolve) => setTimeout(resolve, TICK_MS));
  }
}

void main();
