import { eq } from "drizzle-orm";

import { json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { assertFreeName, deleteNode, idFrom, liveNode, moveNode } from "@/lib/test-plans/data";
import { NodeChangeSchema } from "@/lib/test-plans/validation";

type Context = { params: Promise<{ nodeId: string }> };

/** Rename, or move up / down among its neighbours. */
export const PATCH = route(async (request: Request, context: Context) => {
  await requireApi("testPlans", "write");
  const node = await liveNode(await idFrom(context.params, "nodeId", "nod"));
  const body = await readBody(request, NodeChangeSchema);
  if ("move" in body) {
    await moveNode(node.id, body.move);
  } else {
    await assertFreeName(node.projectId, node.parentId, body.name, node.id);
    await db.update(schema.tpNodes).set({ name: body.name }).where(eq(schema.tpNodes.id, node.id));
  }
  return json({ ok: true });
});

/** Goes to Deleted with its folders and test cases. */
export const DELETE = route(async (_request: Request, context: Context) => {
  await requireApi("testPlans", "write");
  const node = await liveNode(await idFrom(context.params, "nodeId", "nod"));
  return json(await deleteNode(node.id));
});
