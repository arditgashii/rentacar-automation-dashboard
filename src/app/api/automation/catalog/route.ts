import { buildTree } from "@/lib/automation/catalog";
import { readCatalog } from "@/lib/automation/state";
import { json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db } from "@/lib/db";

/** The tree without the tests of each file; the suite editor loads those when a file opens. */
export const GET = route(async () => {
  await requireApi("automation");
  const catalog = await readCatalog(db);
  const tree = buildTree(catalog.tests).map((module) => ({
    ...module,
    features: module.features.map((feature) => ({
      ...feature,
      files: feature.files.map(({ tests, ...file }) => ({ ...file, testCount: tests.length, costly: tests.some((t) => t.markers.includes("costly")) })),
    })),
  }));
  return json({ generatedAt: catalog.generatedAt, error: catalog.error ?? null, total: catalog.tests.length, tree });
});
