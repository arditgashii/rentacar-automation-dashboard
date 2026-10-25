import { eq } from "drizzle-orm";
import { z } from "zod";

import { QueueError, enqueue } from "@/lib/automation/queue";
import { appId, NodeIdSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { assertNotDemo, requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

const Body = z.strictObject({ nodeid: NodeIdSchema.optional() });

/** Runs the same tests again, or one test of the run. Never retries, like any Run now. */
export const POST = route(async (request: Request, context: { params: Promise<{ runId: string }> }) => {
  const user = await requireApi("automation", "write");
  assertNotDemo();
  const parsed = appId("run").safeParse((await context.params).runId);
  if (!parsed.success) return errorResponse(404, "Run not found.");
  const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, parsed.data) });
  if (!run) return errorResponse(404, "Run not found.");
  const { nodeid } = await readBody(request, Body);

  let name = run.name;
  let options = { ...run.options, retries: 0, headed: false, watch: false };
  if (nodeid) {
    const test = await db.query.runTests.findFirst({ where: eq(schema.runTests.nodeid, nodeid) });
    name = test ? `${test.testCaseId ?? ""} ${test.title}`.trim() : "One test";
    // A single test always runs, whatever the test set or LLM credits choice of the original run was.
    options = { ...options, target: { kind: "tests", selection: [{ kind: "test", nodeid }] }, testSet: "full", includeCostly: true };
  }
  try {
    const queued = await enqueue(db, {
      name,
      trigger: "on_demand",
      options,
      rerunOf: run.id,
      suiteId: nodeid ? undefined : (run.suiteId ?? undefined),
      createdBy: user.id,
    });
    return json(queued, 201);
  } catch (error) {
    if (error instanceof QueueError) return errorResponse(409, error.message);
    throw error;
  }
});
