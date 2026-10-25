// What a target (tests or a suite) runs today, for the dialog summary and for saving a run.

import { eq } from "drizzle-orm";

import { type Db, schema } from "@/lib/db";
import { buildTree, hasCostly, missingItems, resolveTests, selectionName, summarize } from "./catalog";
import { readCatalog } from "./state";
import type { CatalogTest, RunTarget, SelectionItem, TestSet } from "./types";

export type Resolved = {
  tests: CatalogTest[];
  selection: SelectionItem[];
  exclude: string[];
  name: string;
  summary: string;
  hasSmoke: boolean;
  hasCostly: boolean;
  missing: number;
};

export async function resolveTarget(
  db: Db,
  target: RunTarget,
  options: { testSet: TestSet; includeCostly: boolean },
): Promise<Resolved | null> {
  const catalog = await readCatalog(db);
  let selection: SelectionItem[];
  let exclude: string[] = [];
  let name: string;
  if (target.kind === "suite") {
    const suite = await db.query.suites.findFirst({ where: eq(schema.suites.id, target.suiteId) });
    if (!suite) return null;
    selection = suite.items.include;
    exclude = suite.items.exclude;
    name = suite.name;
  } else {
    selection = target.selection;
    name = selectionName(selection, catalog.tests);
  }
  const everything = resolveTests(catalog.tests, selection, { exclude, testSet: "full", includeCostly: true });
  const tests = resolveTests(catalog.tests, selection, { exclude, ...options });
  const summary =
    target.kind === "suite"
      ? `${tests.length} ${tests.length === 1 ? "test" : "tests"} in the suite ${name} on Local`
      : summarize(tests.length, selection, buildTree(catalog.tests));
  return {
    tests,
    selection,
    exclude,
    name,
    summary,
    hasSmoke: everything.some((test) => test.markers.includes("smoke")),
    hasCostly: hasCostly(everything),
    missing: missingItems(catalog.tests, selection).length,
  };
}
