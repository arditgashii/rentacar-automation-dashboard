import { and, eq, isNull, ne, sql } from "drizzle-orm";

import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { deleteProject, idFrom } from "@/lib/test-plans/data";
import { ProjectSchema } from "@/lib/test-plans/validation";

type Context = { params: Promise<{ projectId: string }> };

async function liveProject(context: Context) {
  const id = await idFrom(context.params, "projectId", "prj");
  return db.query.tpProjects.findFirst({ where: and(eq(schema.tpProjects.id, id), isNull(schema.tpProjects.deletedAt)) });
}

export const PATCH = route(async (request: Request, context: Context) => {
  await requireApi("testPlans", "write");
  const project = await liveProject(context);
  if (!project) return errorResponse(404, "Project not found.");
  const { name } = await readBody(request, ProjectSchema);
  const taken = await db.query.tpProjects.findFirst({
    where: and(sql`lower(${schema.tpProjects.name}) = ${name.toLowerCase()}`, isNull(schema.tpProjects.deletedAt), ne(schema.tpProjects.id, project.id)),
  });
  if (taken) return errorResponse(409, `A project named "${taken.name}" already exists.`);
  await db.update(schema.tpProjects).set({ name }).where(eq(schema.tpProjects.id, project.id));
  return json({ ok: true });
});

/** The project goes to Deleted with its suites and test cases. */
export const DELETE = route(async (_request: Request, context: Context) => {
  await requireApi("testPlans", "write");
  const project = await liveProject(context);
  if (!project) return errorResponse(404, "Project not found.");
  await deleteProject(project.id);
  return json({ ok: true });
});
