import { and, eq, isNull } from "drizzle-orm";

import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { assertFreeName, liveNode, nextPosition } from "@/lib/test-plans/data";
import { NewNodeSchema } from "@/lib/test-plans/validation";

/** A suite (no parent) or a folder inside a suite or folder. */
export const POST = route(async (request: Request) => {
  await requireApi("testPlans", "write");
  const body = await readBody(request, NewNodeSchema);
  const project = await db.query.tpProjects.findFirst({ where: and(eq(schema.tpProjects.id, body.projectId), isNull(schema.tpProjects.deletedAt)) });
  if (!project) return errorResponse(404, "Project not found.");
  if (body.parentId) {
    const parent = await liveNode(body.parentId);
    if (parent.projectId !== project.id) return errorResponse(400, "The folder belongs to another project.");
  }
  await assertFreeName(project.id, body.parentId, body.name);
  const id = newId("nod");
  await db.insert(schema.tpNodes).values({
    id,
    projectId: project.id,
    parentId: body.parentId,
    kind: body.parentId ? "folder" : "suite",
    name: body.name,
    position: await nextPosition(project.id, body.parentId),
  });
  return json({ id }, 201);
});
