import { z } from "zod";

import { cancelQueued, moveToTop } from "@/lib/automation/queue";
import { appId } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const Body = z.strictObject({ action: z.enum(["top", "cancel"]) });

export const POST = route(async (request: Request, context: { params: Promise<{ runId: string }> }) => {
  await requireApi("automation", "write");
  const parsed = appId("run").safeParse((await context.params).runId);
  if (!parsed.success) return errorResponse(404, "Run not found.");
  const { action } = await readBody(request, Body);
  if (action === "top") await moveToTop(db, parsed.data);
  else if (!(await cancelQueued(db, parsed.data))) return errorResponse(409, "This run is not in the queue any more.");
  return json({ ok: true });
});
