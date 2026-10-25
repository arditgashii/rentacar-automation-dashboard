import { desc, inArray, sql } from "drizzle-orm";

import { resolveTests } from "@/lib/automation/catalog";
import { readCatalog } from "@/lib/automation/state";
import { SuiteSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

export const GET = route(async () => {
  await requireApi("automation");
  const suites = await db.select().from(schema.suites).orderBy(desc(schema.suites.updatedAt));
  const catalog = await readCatalog(db);
  const ids = suites.map((s) => s.id);
  const lastRuns = ids.length
    ? await db
        .selectDistinctOn([schema.runs.suiteId], {
          suiteId: schema.runs.suiteId,
          id: schema.runs.id,
          number: schema.runs.number,
          status: schema.runs.status,
          queuedAt: schema.runs.queuedAt,
        })
        .from(schema.runs)
        .where(inArray(schema.runs.suiteId, ids))
        .orderBy(schema.runs.suiteId, desc(schema.runs.queuedAt))
    : [];
  const userIds = suites.flatMap((s) => (s.createdBy ? [s.createdBy] : []));
  const users = userIds.length ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, userIds)) : [];
  return json({
    suites: suites.map((suite) => {
      const tests = resolveTests(catalog.tests, suite.items.include, { exclude: suite.items.exclude, testSet: "full", includeCostly: true });
      const last = lastRuns.find((run) => run.suiteId === suite.id);
      return {
        id: suite.id,
        name: suite.name,
        description: suite.description,
        testCount: tests.length,
        costly: tests.some((t) => t.markers.includes("costly")),
        lastRun: last ? { id: last.id, number: last.number, status: last.status, at: last.queuedAt.toISOString() } : null,
        createdBy: users.find((u) => u.id === suite.createdBy)?.name ?? null,
        updatedAt: suite.updatedAt.toISOString(),
      };
    }),
  });
});

export const POST = route(async (request: Request) => {
  const user = await requireApi("automation", "write");
  const body = await readBody(request, SuiteSchema);
  const taken = await db.query.suites.findFirst({ where: sql`lower(${schema.suites.name}) = ${body.name.toLowerCase()}` });
  if (taken) return errorResponse(409, `A suite named "${taken.name}" already exists.`);
  const id = newId("ste");
  await db.insert(schema.suites).values({ id, ...body, createdBy: user.id });
  return json({ id }, 201);
});
