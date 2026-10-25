// Starts due schedules. A slot that passed while the worker was not running is marked Missed and the
// schedule moves on; nothing is started late.

import { and, eq, isNotNull, lte } from "drizzle-orm";

import { QueueError, enqueue } from "@/lib/automation/queue";
import { slotAfter } from "@/lib/automation/schedule";
import { db, schema } from "@/lib/db";

const MISSED_AFTER_MS = 10 * 60_000;
// Scheduled runs retry a failing test twice; a test that passes on a retry is reported as flaky.
const SCHEDULED_RETRIES = 2;

export async function startDueSchedules(now: Date): Promise<void> {
  const due = await db
    .select()
    .from(schema.schedules)
    .where(and(eq(schema.schedules.paused, false), isNotNull(schema.schedules.nextRunAt), lte(schema.schedules.nextRunAt, now)));

  for (const schedule of due) {
    const slot = schedule.nextRunAt!;
    const rule = { repeat: schedule.repeat, days: schedule.days, time: schedule.time };
    const next = slotAfter(rule, slot, now);
    if (now.getTime() - slot.getTime() > MISSED_AFTER_MS) {
      await db.update(schema.schedules).set({ missedAt: slot, nextRunAt: next }).where(eq(schema.schedules.id, schedule.id));
      console.log(`[schedule] ${schedule.name} missed its slot at ${slot.toISOString()}`);
      continue;
    }
    let lastRunId = schedule.lastRunId;
    try {
      const run = await enqueue(db, {
        name: schedule.name,
        trigger: "scheduled",
        options: { ...schedule.target, environment: "local", headed: false, watch: false, retries: SCHEDULED_RETRIES },
        scheduleId: schedule.id,
        suiteId: schedule.target.target.kind === "suite" ? schedule.target.target.suiteId : undefined,
        createdBy: schedule.createdBy ?? undefined,
      });
      lastRunId = run.id;
      console.log(`[schedule] ${schedule.name} queued as ${run.id}`);
    } catch (error) {
      if (!(error instanceof QueueError)) throw error;
      console.log(`[schedule] ${schedule.name} not queued: ${error.message}`);
    }
    await db
      .update(schema.schedules)
      .set({ nextRunAt: next, lastRunId, missedAt: null })
      .where(eq(schema.schedules.id, schedule.id));
  }
}
