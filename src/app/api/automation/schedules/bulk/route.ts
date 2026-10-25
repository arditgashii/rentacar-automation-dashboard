import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { firstSlot } from "@/lib/automation/schedules-data";
import { appId } from "@/lib/automation/validation";
import { json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

const Body = z.strictObject({
  ids: z.array(appId("sch")).min(1).max(200),
  action: z.enum(["pause", "resume", "delete"]),
});

export const POST = route(async (request: Request) => {
  await requireApi("automation", "write");
  const { ids, action } = await readBody(request, Body);
  if (action === "delete") {
    await db.delete(schema.schedules).where(inArray(schema.schedules.id, ids));
    return json({ ok: true });
  }
  const rows = await db.select().from(schema.schedules).where(inArray(schema.schedules.id, ids));
  for (const row of rows) {
    const paused = action === "pause";
    await db
      .update(schema.schedules)
      .set({ paused, nextRunAt: paused ? null : firstSlot(row), missedAt: null, updatedAt: new Date() })
      .where(eq(schema.schedules.id, row.id));
  }
  return json({ ok: true });
});
