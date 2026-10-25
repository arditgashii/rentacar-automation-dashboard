import { and, desc, eq, ne, sql } from "drizzle-orm";

import { cardsFor } from "@/lib/automation/runs-data";
import { appId, SuiteSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

type Context = { params: Promise<{ suiteId: string }> };

async function suiteFrom(context: Context) {
  const parsed = appId("ste").safeParse((await context.params).suiteId);
  return parsed.success ? db.query.suites.findFirst({ where: eq(schema.suites.id, parsed.data) }) : undefined;
}

export const GET = route(async (_request: Request, context: Context) => {
  await requireApi("automation");
  const suite = await suiteFrom(context);
  if (!suite) return errorResponse(404, "Suite not found.");
  const runs = await db.select().from(schema.runs).where(eq(schema.runs.suiteId, suite.id)).orderBy(desc(schema.runs.queuedAt)).limit(20);
  return json({
    suite: { id: suite.id, name: suite.name, description: suite.description, items: suite.items, updatedAt: suite.updatedAt.toISOString() },
    runs: await cardsFor(db, runs),
  });
});

export const PUT = route(async (request: Request, context: Context) => {
  await requireApi("automation", "write");
  const suite = await suiteFrom(context);
  if (!suite) return errorResponse(404, "Suite not found.");
  const body = await readBody(request, SuiteSchema);
  const taken = await db.query.suites.findFirst({
    where: and(sql`lower(${schema.suites.name}) = ${body.name.toLowerCase()}`, ne(schema.suites.id, suite.id)),
  });
  if (taken) return errorResponse(409, `A suite named "${taken.name}" already exists.`);
  await db.update(schema.suites).set({ ...body, updatedAt: new Date() }).where(eq(schema.suites.id, suite.id));
  return json({ ok: true });
});

export const DELETE = route(async (_request: Request, context: Context) => {
  await requireApi("automation", "write");
  const suite = await suiteFrom(context);
  if (!suite) return errorResponse(404, "Suite not found.");
  await db.delete(schema.suites).where(eq(schema.suites.id, suite.id));
  return json({ ok: true });
});
