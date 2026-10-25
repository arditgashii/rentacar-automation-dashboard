import { eq } from "drizzle-orm";
import { z } from "zod";

import { validateRule } from "@/lib/automation/schedule";
import { firstSlot, getSchedule } from "@/lib/automation/schedules-data";
import { appId, ScheduleSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

type Context = { params: Promise<{ scheduleId: string }> };

async function scheduleFrom(context: Context) {
  const parsed = appId("sch").safeParse((await context.params).scheduleId);
  return parsed.success ? getSchedule(db, parsed.data) : undefined;
}

/** Edit: the whole schedule from the dialog. */
export const PUT = route(async (request: Request, context: Context) => {
  await requireApi("automation", "write");
  const schedule = await scheduleFrom(context);
  if (!schedule) return errorResponse(404, "Schedule not found.");
  const body = await readBody(request, ScheduleSchema);
  const problem = validateRule({ repeat: body.repeat, days: body.days, time: body.time }, new Date());
  if (problem) return errorResponse(400, problem);
  const days = body.repeat === "custom" ? body.days : [];
  await db
    .update(schema.schedules)
    .set({
      name: body.name,
      target: { target: body.target, testSet: body.testSet, includeCostly: body.includeCostly },
      repeat: body.repeat,
      days,
      time: body.time,
      nextRunAt: schedule.paused ? null : firstSlot({ repeat: body.repeat, days, time: body.time }),
      missedAt: null,
      teamsChannelId: body.teamsChannelId,
      teamsMode: body.teamsMode,
      teamsBugReports: body.teamsBugReports,
      updatedAt: new Date(),
    })
    .where(eq(schema.schedules.id, schedule.id));
  return json({ ok: true });
});

const Patch = z.strictObject({ paused: z.boolean() });

/** Pause or resume. A resumed schedule starts again at its next slot from now. */
export const PATCH = route(async (request: Request, context: Context) => {
  await requireApi("automation", "write");
  const schedule = await scheduleFrom(context);
  if (!schedule) return errorResponse(404, "Schedule not found.");
  const { paused } = await readBody(request, Patch);
  await db
    .update(schema.schedules)
    .set({ paused, nextRunAt: paused ? null : firstSlot(schedule), missedAt: null, updatedAt: new Date() })
    .where(eq(schema.schedules.id, schedule.id));
  return json({ ok: true });
});

export const DELETE = route(async (_request: Request, context: Context) => {
  await requireApi("automation", "write");
  const schedule = await scheduleFrom(context);
  if (!schedule) return errorResponse(404, "Schedule not found.");
  await db.delete(schema.schedules).where(eq(schema.schedules.id, schedule.id));
  return json({ ok: true });
});
