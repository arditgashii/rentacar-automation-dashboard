import { and, isNull, sql } from "drizzle-orm";

import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { ProjectSchema } from "@/lib/test-plans/validation";

export const POST = route(async (request: Request) => {
  await requireApi("testPlans", "write");
  const { name } = await readBody(request, ProjectSchema);
  const taken = await db.query.tpProjects.findFirst({ where: and(sql`lower(${schema.tpProjects.name}) = ${name.toLowerCase()}`, isNull(schema.tpProjects.deletedAt)) });
  if (taken) return errorResponse(409, `A project named "${taken.name}" already exists.`);
  const id = newId("prj");
  await db.insert(schema.tpProjects).values({ id, name });
  return json({ id }, 201);
});
