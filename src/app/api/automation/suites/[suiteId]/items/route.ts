import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildTree } from "@/lib/automation/catalog";
import { readCatalog } from "@/lib/automation/state";
import { normalizeItems } from "@/lib/automation/suite-selection";
import type { SelectionItem } from "@/lib/automation/types";
import { appId, SelectionItemSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

const Body = z.union([
  z.strictObject({ items: z.array(SelectionItemSchema).min(1).max(50) }),
  z.strictObject({ runId: appId("run") }),
]);

/** What a run covered: its own selection, or the tests it ran when it came from a suite. */
async function itemsOfRun(runId: string): Promise<SelectionItem[] | null> {
  const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) });
  if (!run) return null;
  if (run.options.target.kind === "tests") return run.options.target.selection;
  const tests = await db.select({ nodeid: schema.runTests.nodeid }).from(schema.runTests).where(eq(schema.runTests.runId, run.id));
  return tests.map((test) => ({ kind: "test", nodeid: test.nodeid }));
}

/** Add to suite (from a run card or the run details): merges the items into the suite. */
export const POST = route(async (request: Request, context: { params: Promise<{ suiteId: string }> }) => {
  await requireApi("automation", "write");
  const parsed = appId("ste").safeParse((await context.params).suiteId);
  const suite = parsed.success ? await db.query.suites.findFirst({ where: eq(schema.suites.id, parsed.data) }) : undefined;
  if (!suite) return errorResponse(404, "Suite not found.");
  const body = await readBody(request, Body);
  const items = "items" in body ? body.items : await itemsOfRun(body.runId);
  if (!items) return errorResponse(404, "Run not found.");
  if (items.length === 0) return errorResponse(400, "This run has no tests to add.");
  const tree = buildTree((await readCatalog(db)).tests);
  const merged = normalizeItems({ include: [...suite.items.include, ...items], exclude: suite.items.exclude }, tree);
  await db.update(schema.suites).set({ items: merged, updatedAt: new Date() }).where(eq(schema.suites.id, suite.id));
  return json({ ok: true, name: suite.name });
});
