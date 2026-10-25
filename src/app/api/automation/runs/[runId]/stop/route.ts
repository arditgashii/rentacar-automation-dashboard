import { and, eq } from "drizzle-orm";

import { cancelQueued } from "@/lib/automation/queue";
import { appId } from "@/lib/automation/validation";
import { errorResponse, json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

/** Stops a running run (the worker ends pytest) or cancels a queued one. */
export const POST = route(async (_request: Request, context: { params: Promise<{ runId: string }> }) => {
  await requireApi("automation", "write");
  const parsed = appId("run").safeParse((await context.params).runId);
  if (!parsed.success) return errorResponse(404, "Run not found.");
  const runId = parsed.data;
  if (await cancelQueued(db, runId)) return json({ stopped: true });
  const updated = await db
    .update(schema.runs)
    .set({ stopRequested: true })
    .where(and(eq(schema.runs.id, runId), eq(schema.runs.status, "running")))
    .returning({ id: schema.runs.id });
  if (updated.length === 0) return errorResponse(409, "This run is not running any more.");
  return json({ stopping: true });
});
