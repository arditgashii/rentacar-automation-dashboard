import { firstSlot, listSchedules } from "@/lib/automation/schedules-data";
import { validateRule } from "@/lib/automation/schedule";
import { ScheduleSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

export const GET = route(async () => {
  await requireApi("automation");
  return json({ schedules: await listSchedules(db) });
});

export const POST = route(async (request: Request) => {
  const user = await requireApi("automation", "write");
  const body = await readBody(request, ScheduleSchema);
  const problem = validateRule({ repeat: body.repeat, days: body.days, time: body.time }, new Date());
  if (problem) return errorResponse(400, problem);
  const id = newId("sch");
  const days = body.repeat === "custom" ? body.days : [];
  await db.insert(schema.schedules).values({
    id,
    name: body.name,
    target: { target: body.target, testSet: body.testSet, includeCostly: body.includeCostly },
    repeat: body.repeat,
    days,
    time: body.time,
    nextRunAt: firstSlot({ repeat: body.repeat, days, time: body.time }),
    teamsChannelId: body.teamsChannelId,
    teamsMode: body.teamsMode,
    teamsBugReports: body.teamsBugReports,
    createdBy: user.id,
  });
  return json({ id }, 201);
});
