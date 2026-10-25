import { z } from "zod";

import { validateCustom } from "@/lib/automation/period";
import { QueueError, enqueue } from "@/lib/automation/queue";
import { resolveTarget } from "@/lib/automation/resolve";
import { listRuns } from "@/lib/automation/runs-data";
import { NewRunSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { assertNotDemo, requireApi } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const Filters = z.object({
  started: z.enum(["on_demand", "scheduled"]).optional(),
  module: z.string().max(120).regex(/^[a-z0-9_-]+$/).optional(),
  feature: z.string().max(120).regex(/^[a-z0-9_\-/]+$/).optional(),
  status: z.enum(["queued", "running", "passed", "failed", "stopped", "error", "not_ready"]).optional(),
  period: z.enum(["today", "yesterday", "24h", "7d", "30d", "custom"]).optional(),
  from: z.string().max(10).optional(),
  to: z.string().max(10).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const GET = route(async (request: Request) => {
  await requireApi("automation");
  const params = Object.fromEntries([...new URL(request.url).searchParams].filter(([, value]) => value !== ""));
  const filters = Filters.parse(params);
  if (filters.period === "custom") {
    const problem = validateCustom(filters.from ?? null, filters.to ?? null);
    if (problem) return errorResponse(400, problem);
  }
  return json(await listRuns(db, { ...filters, pageSize: 20 }));
});

/** Run now: the run goes to the queue; the worker starts it when nothing else runs. */
export const POST = route(async (request: Request) => {
  const user = await requireApi("automation", "write");
  assertNotDemo();
  const body = await readBody(request, NewRunSchema);
  const resolved = await resolveTarget(db, body.target, body);
  if (!resolved) return errorResponse(404, "This suite does not exist any more.");
  if (resolved.tests.length === 0) return errorResponse(400, "This choice has no tests to run.");
  try {
    const run = await enqueue(db, {
      name: resolved.name,
      trigger: "on_demand",
      options: { environment: "local", target: body.target, testSet: body.testSet, includeCostly: body.includeCostly, headed: body.headed, watch: body.watch, retries: 0 },
      suiteId: body.target.kind === "suite" ? body.target.suiteId : undefined,
      createdBy: user.id,
    });
    return json(run, 201);
  } catch (error) {
    if (error instanceof QueueError) return errorResponse(409, error.message);
    throw error;
  }
});
