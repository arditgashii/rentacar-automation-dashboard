import { buildTree } from "@/lib/automation/catalog";
import { readCatalog } from "@/lib/automation/state";
import { json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db } from "@/lib/db";

/**
 * The module, feature, file tree. Without `?tests=1` the files carry only their test count (the
 * pickers need no more); the suite editor asks for the tests too, for its selection logic.
 */
export const GET = route(async (request: Request) => {
  await requireApi("automation");
  const withTests = new URL(request.url).searchParams.get("tests") === "1";
  const catalog = await readCatalog(db);
  const tree = buildTree(catalog.tests).map((module) => ({
    ...module,
    features: module.features.map((feature) => ({
      ...feature,
      files: feature.files.map(({ tests, ...file }) => ({
        ...file,
        testCount: tests.length,
        costly: tests.some((t) => t.markers.includes("costly")),
        ...(withTests ? { tests } : {}),
      })),
    })),
  }));
  return json({ generatedAt: catalog.generatedAt, error: catalog.error ?? null, total: catalog.tests.length, tree });
});
