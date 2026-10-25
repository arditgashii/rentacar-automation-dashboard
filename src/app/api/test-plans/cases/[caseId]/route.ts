import { eq } from "drizzle-orm";

import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { caseDetails, deleteCases, idFrom, liveCase, liveNode } from "@/lib/test-plans/data";
import { CaseSchema } from "@/lib/test-plans/validation";

type Context = { params: Promise<{ caseId: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  const user = await requireApi("testPlans");
  const details = await caseDetails(await idFrom(context.params, "caseId", "tcs"));
  // The run behind the latest result opens only for those who can see Automation Tests.
  const latest = details.latestResult && (user.role === "admin" ? details.latestResult : { ...details.latestResult, runId: null });
  return json({ ...details, latestResult: latest });
});

/** Saves every field. Moving to another suite or folder stays inside the project. */
export const PUT = route(async (request: Request, context: Context) => {
  const user = await requireApi("testPlans", "write");
  const current = await liveCase(await idFrom(context.params, "caseId", "tcs"));
  const body = await readBody(request, CaseSchema);
  const node = await liveNode(body.nodeId).catch(() => null);
  if (!node) return errorResponse(400, "The suite or folder was deleted. Choose another one.");
  if (node.projectId !== current.projectId) return errorResponse(400, "A test case stays in its project.");
  const [saved] = await db
    .update(schema.tpCases)
    .set({ ...body, updatedBy: user.id, updatedAt: new Date() })
    .where(eq(schema.tpCases.id, current.id))
    .returning({ updatedAt: schema.tpCases.updatedAt });
  return json({ ok: true, updatedAt: saved.updatedAt.toISOString() });
});

/** Goes to Deleted. Its TC number is never given to another test case. */
export const DELETE = route(async (_request: Request, context: Context) => {
  await requireApi("testPlans", "write");
  const current = await liveCase(await idFrom(context.params, "caseId", "tcs"));
  await deleteCases([current.id]);
  return json({ ok: true });
});
