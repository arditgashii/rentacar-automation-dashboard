import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { liveNode, takeNumber } from "@/lib/test-plans/data";
import { CaseSchema } from "@/lib/test-plans/validation";

/** A new test case gets the next TC number of its project. */
export const POST = route(async (request: Request) => {
  const user = await requireApi("testPlans", "write");
  const body = await readBody(request, CaseSchema);
  const node = await liveNode(body.nodeId).catch(() => null);
  if (!node) return errorResponse(400, "The suite or folder was deleted. Choose another one.");
  const id = newId("tcs");
  const number = await db.transaction(async (tx) => {
    const taken = await takeNumber(tx, node.projectId);
    await tx.insert(schema.tpCases).values({ ...body, id, projectId: node.projectId, number: taken, createdBy: user.id, updatedBy: user.id });
    return taken;
  });
  return json({ id, number }, 201);
});
