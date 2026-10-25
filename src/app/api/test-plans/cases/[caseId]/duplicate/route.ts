import { json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { idFrom, liveCase, takeNumber } from "@/lib/test-plans/data";

/** A copy with a new TC number, as Draft. Attachments are not copied. */
export const POST = route(async (_request: Request, context: { params: Promise<{ caseId: string }> }) => {
  const user = await requireApi("testPlans", "write");
  const source = await liveCase(await idFrom(context.params, "caseId", "tcs"));
  const id = newId("tcs");
  const number = await db.transaction(async (tx) => {
    const taken = await takeNumber(tx, source.projectId);
    await tx.insert(schema.tpCases).values({
      id,
      projectId: source.projectId,
      nodeId: source.nodeId,
      number: taken,
      title: source.title,
      state: "draft",
      priority: source.priority,
      tags: source.tags,
      description: source.description,
      preconditions: source.preconditions,
      steps: source.steps,
      type: source.type,
      automation: source.automation,
      automatedTest: source.automatedTest,
      createdBy: user.id,
      updatedBy: user.id,
    });
    return taken;
  });
  return json({ id, number }, 201);
});
