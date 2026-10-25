import type { CatalogTest, SelectionItem, TestSet } from "./types";

/** "cars/generate-description" -> "Cars / Generate description", "no-login" -> "No login". */
export function label(value: string): string {
  return value
    .split("/")
    .map((part) => {
      const words = part.replace(/[-_]/g, " ").trim();
      return words.charAt(0).toUpperCase() + words.slice(1);
    })
    .join(" / ");
}

export function fileLabel(file: string): string {
  const name = file.split("/").pop() ?? file;
  return name.replace(/^test_tc_\d+_/, "").replace(/\.py$/, "").replace(/_/g, " ");
}

export type TreeFile = { file: string; label: string; role: string; tests: CatalogTest[] };
export type TreeFeature = { module: string; feature: string; label: string; files: TreeFile[]; testCount: number };
export type TreeModule = { module: string; label: string; features: TreeFeature[]; testCount: number };

/** Module, feature, file, test: the tree the pickers and the suite editor show. Sorted by name. */
export function buildTree(tests: CatalogTest[]): TreeModule[] {
  const modules = new Map<string, Map<string, Map<string, CatalogTest[]>>>();
  for (const test of tests) {
    const features = modules.get(test.module) ?? new Map<string, Map<string, CatalogTest[]>>();
    const files = features.get(test.feature) ?? new Map<string, CatalogTest[]>();
    files.set(test.file, [...(files.get(test.file) ?? []), test]);
    features.set(test.feature, files);
    modules.set(test.module, features);
  }
  const byName = <T extends { label: string }>(a: T, b: T) => a.label.localeCompare(b.label);
  return [...modules].map(([module, features]) => {
    const featureList = [...features].map(([feature, files]) => {
      const fileList = [...files].map(([file, fileTests]) => ({
        file,
        label: fileLabel(file),
        role: fileTests[0]?.role ?? "",
        tests: [...fileTests].sort((a, b) => a.line - b.line),
      }));
      return {
        module,
        feature,
        label: label(feature),
        files: fileList.sort(byName),
        testCount: fileList.reduce((sum, file) => sum + file.tests.length, 0),
      };
    });
    return {
      module,
      label: label(module),
      features: featureList.sort(byName),
      testCount: featureList.reduce((sum, feature) => sum + feature.testCount, 0),
    };
  }).sort(byName);
}

function matches(test: CatalogTest, item: SelectionItem): boolean {
  switch (item.kind) {
    case "module":
      return test.module === item.module;
    case "feature":
      return test.module === item.module && (test.feature === item.feature || test.feature.startsWith(`${item.feature}/`));
    case "file":
      return test.file === item.file;
    case "test":
      return test.nodeid === item.nodeid;
  }
}

/**
 * The tests a run will execute: everything the selection covers, minus excluded tests, filtered by
 * the test set (smoke or full) and the LLM credits choice. The worker passes exactly these to pytest.
 */
export function resolveTests(
  tests: CatalogTest[],
  selection: SelectionItem[],
  options: { exclude?: string[]; testSet: TestSet; includeCostly: boolean },
): CatalogTest[] {
  const exclude = new Set(options.exclude ?? []);
  return tests.filter(
    (test) =>
      selection.some((item) => matches(test, item)) &&
      !exclude.has(test.nodeid) &&
      (options.testSet === "full" || test.markers.includes("smoke")) &&
      (options.includeCostly || !test.markers.includes("costly")),
  );
}

/** Tests the selection names that are no longer in the catalog (a deleted file or test). */
export function missingItems(tests: CatalogTest[], selection: SelectionItem[]): SelectionItem[] {
  return selection.filter((item) => !tests.some((test) => matches(test, item)));
}

export function hasCostly(tests: CatalogTest[]): boolean {
  return tests.some((test) => test.markers.includes("costly"));
}

/** "6 tests in Fleet (All) on Local", the live summary under the run dialog. */
export function summarize(count: number, selection: SelectionItem[], tree: TreeModule[]): string {
  const noun = count === 1 ? "test" : "tests";
  if (selection.length === 0) return `${count} ${noun}`;
  const modules = [...new Set(selection.map((item) => moduleOf(item, tree)).filter(Boolean))];
  const where =
    modules.length === 1
      ? `${modules[0]} (${selection.every((item) => item.kind === "module") ? "All" : `${selection.length} selected`})`
      : `${modules.length} modules`;
  return `${count} ${noun} in ${where} on Local`;
}

function moduleOf(item: SelectionItem, tree: TreeModule[]): string | undefined {
  if (item.kind === "module" || item.kind === "feature") return tree.find((m) => m.module === item.module)?.label;
  const file = item.kind === "file" ? item.file : item.nodeid.split("::")[0];
  return tree.find((module) => module.features.some((feature) => feature.files.some((f) => f.file === file)))?.label;
}

/** A readable name for a run of this selection, for example "Fleet / Cars / Create" or "3 areas". */
export function selectionName(selection: SelectionItem[], tests: CatalogTest[]): string {
  if (selection.length !== 1) return `${selection.length} areas`;
  const [item] = selection;
  switch (item.kind) {
    case "module":
      return label(item.module);
    case "feature":
      return `${label(item.module)} / ${label(item.feature)}`;
    case "file":
      return fileLabel(item.file);
    case "test": {
      const test = tests.find((candidate) => candidate.nodeid === item.nodeid);
      return test ? `${test.testCaseId ?? ""} ${test.title}`.trim() : "One test";
    }
  }
}
