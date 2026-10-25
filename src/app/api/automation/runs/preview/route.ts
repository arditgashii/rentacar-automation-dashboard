import { resolveTarget } from "@/lib/automation/resolve";
import { PreviewSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db } from "@/lib/db";

/** The live summary of the run dialog: how many tests the choice runs, the same way the worker counts. */
export const POST = route(async (request: Request) => {
  await requireApi("automation");
  const body = await readBody(request, PreviewSchema);
  const resolved = await resolveTarget(db, body.target, body);
  if (!resolved) return errorResponse(404, "This suite does not exist any more.");
  return json({
    count: resolved.tests.length,
    summary: resolved.summary,
    hasSmoke: resolved.hasSmoke,
    hasCostly: resolved.hasCostly,
    missing: resolved.missing,
  });
});
