import { eq } from "drizzle-orm";

import { QueueError, enqueue } from "@/lib/automation/queue";
import { resolveTarget } from "@/lib/automation/resolve";
import { getSchedule } from "@/lib/automation/schedules-data";
import { appId } from "@/lib/automation/validation";
import { errorResponse, json, route } from "@/lib/api";
import { assertNotDemo, requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

/** Run now from the schedule menu: starts at once, without retries (only planned runs retry). */
export const POST = route(async (_request: Request, context: { params: Promise<{ scheduleId: string }> }) => {
  const user = await requireApi("automation", "write");
  assertNotDemo();
  const parsed = appId("sch").safeParse((await context.params).scheduleId);
  const schedule = parsed.success ? await getSchedule(db, parsed.data) : undefined;
  if (!schedule) return errorResponse(404, "Schedule not found.");
  const resolved = await resolveTarget(db, schedule.target.target, schedule.target);
  if (!resolved || resolved.tests.length === 0) return errorResponse(400, "Tests no longer available.");
  try {
    const run = await enqueue(db, {
      name: schedule.name,
      trigger: "on_demand",
      options: { ...schedule.target, environment: "local", headed: false, watch: false, retries: 0 },
      suiteId: schedule.target.target.kind === "suite" ? schedule.target.target.suiteId : undefined,
      createdBy: user.id,
    });
    await db.update(schema.schedules).set({ lastRunId: run.id }).where(eq(schema.schedules.id, schedule.id));
    return json(run, 201);
  } catch (error) {
    if (error instanceof QueueError) return errorResponse(409, error.message);
    throw error;
  }
});
