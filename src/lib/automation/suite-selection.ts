// Smart selection for the suite editor.
//
// The suite keeps the smallest description of what is chosen: a module when all its features are in,
// a feature when all its files are in, a file when all its tests are in. Turning a feature or a file off
// inside a chosen group keeps the rest of the group (the group is expanded around it). Turning a single
// test off inside a chosen group leaves just that test out ("1 test left out", with Put back).

import type { TreeModule } from "./catalog";
import type { SelectionItem, SuiteItems } from "./types";

export type CheckState = boolean | "indeterminate";

type Group = Exclude<SelectionItem, { kind: "test" }>;


/** The tests below an item, from the catalog tree. */
export function testsOf(item: SelectionItem, tree: TreeModule[]): string[] {
  const all = tree.flatMap((module) =>
    module.features.flatMap((feature) =>
      feature.files.flatMap((file) => file.tests.map((test) => ({ module, feature, file, nodeid: test.nodeid }))),
    ),
  );
  switch (item.kind) {
    case "module":
      return all.filter((t) => t.module.module === item.module).map((t) => t.nodeid);
    case "feature":
      return all.filter((t) => t.module.module === item.module && t.feature.feature === item.feature).map((t) => t.nodeid);
    case "file":
      return all.filter((t) => t.file.file === item.file).map((t) => t.nodeid);
    case "test":
      return all.some((t) => t.nodeid === item.nodeid) ? [item.nodeid] : [];
  }
}

/** The children of a group in the tree: features of a module, files of a feature, tests of a file. */
function childrenOf(group: Group, tree: TreeModule[]): SelectionItem[] {
  const parent = tree.find((m) => m.module === (group.kind === "file" ? undefined : group.module));
  if (group.kind === "module") {
    return (parent?.features ?? []).map((f) => ({ kind: "feature", module: f.module, feature: f.feature }));
  }
  if (group.kind === "feature") {
    const feature = parent?.features.find((f) => f.feature === group.feature);
    return (feature?.files ?? []).map((f) => ({ kind: "file", file: f.file }));
  }
  const file = tree.flatMap((m) => m.features.flatMap((f) => f.files)).find((f) => f.file === group.file);
  return (file?.tests ?? []).map((t) => ({ kind: "test", nodeid: t.nodeid }));
}

/** True when `inner` lies inside `outer` (or is the same item). */
function isWithin(inner: SelectionItem, outer: SelectionItem, tree: TreeModule[]): boolean {
  if (JSON.stringify(inner) === JSON.stringify(outer)) return true;
  const innerTests = testsOf(inner, tree);
  const outerTests = new Set(testsOf(outer, tree));
  return innerTests.length > 0 && innerTests.every((id) => outerTests.has(id)) && outer.kind !== "test" && depth(inner) > depth(outer);
}

function depth(item: SelectionItem): number {
  return { module: 0, feature: 1, file: 2, test: 3 }[item.kind];
}

/** Replaces a chosen group by its children, except the branch that leads to `target`, which is expanded further. */
function expandAround(group: SelectionItem, target: SelectionItem, tree: TreeModule[]): SelectionItem[] {
  if (JSON.stringify(group) === JSON.stringify(target) || group.kind === "test") return [];
  return childrenOf(group, tree).flatMap((child) =>
    isWithin(target, child, tree) ? expandAround(child, target, tree) : [child],
  );
}

/** Is this test part of the suite? */
export function isTestIncluded(items: SuiteItems, tree: TreeModule[], nodeid: string): boolean {
  if (items.exclude.includes(nodeid)) return false;
  return items.include.some((item) => testsOf(item, tree).includes(nodeid));
}

/** Checked, unchecked or indeterminate, for the checkbox of a node with these tests. */
export function stateOf(items: SuiteItems, tree: TreeModule[], nodeids: string[]): CheckState {
  const chosen = nodeids.filter((id) => isTestIncluded(items, tree, id)).length;
  if (chosen === 0) return false;
  return chosen === nodeids.length ? true : "indeterminate";
}

/** Collapses complete groups upwards: all tests of a file -> the file, all files -> the feature, and so on. */
function collapse(include: SelectionItem[], tree: TreeModule[]): SelectionItem[] {
  let items = [...include];
  const covered = (child: SelectionItem) => items.some((item) => isWithin(child, item, tree));
  for (const node of tree) {
    for (const feature of node.features) {
      for (const file of feature.files) {
        const tests = file.tests.map((t): SelectionItem => ({ kind: "test", nodeid: t.nodeid }));
        if (tests.length && tests.every(covered) && !covered({ kind: "file", file: file.file })) {
          items = items.filter((item) => !isWithin(item, { kind: "file", file: file.file }, tree));
          items.push({ kind: "file", file: file.file });
        }
      }
      const featureItem: SelectionItem = { kind: "feature", module: node.module, feature: feature.feature };
      const files = feature.files.map((f): SelectionItem => ({ kind: "file", file: f.file }));
      if (files.length && files.every(covered) && !covered(featureItem)) {
        items = items.filter((item) => !isWithin(item, featureItem, tree));
        items.push(featureItem);
      }
    }
    const moduleItem: SelectionItem = { kind: "module", module: node.module };
    const features = node.features.map((f): SelectionItem => ({ kind: "feature", module: f.module, feature: f.feature }));
    if (features.length && features.every(covered) && !covered(moduleItem)) {
      items = items.filter((item) => !isWithin(item, moduleItem, tree));
      items.push(moduleItem);
    }
  }
  return items;
}

/** Turns a module, feature, file or single test on or off. */
export function toggle(items: SuiteItems, tree: TreeModule[], target: SelectionItem, on: boolean): SuiteItems {
  let include = [...items.include];
  let exclude = [...items.exclude];

  if (target.kind === "test") {
    if (on) {
      exclude = exclude.filter((id) => id !== target.nodeid);
      if (!isTestIncluded({ include, exclude }, tree, target.nodeid)) include.push(target);
    } else if (include.some((item) => item.kind === "test" && item.nodeid === target.nodeid)) {
      include = include.filter((item) => !(item.kind === "test" && item.nodeid === target.nodeid));
    } else if (!exclude.includes(target.nodeid)) {
      exclude.push(target.nodeid);
    }
    return { include: collapse(include, tree), exclude };
  }

  const scope = new Set(testsOf(target, tree));
  exclude = exclude.filter((id) => !scope.has(id));
  if (on) {
    include = include.filter((item) => !isWithin(item, target, tree));
    include.push(target);
  } else {
    include = include.flatMap((item) => {
      if (isWithin(item, target, tree)) return [];
      if (isWithin(target, item, tree)) return expandAround(item, target, tree);
      return [item];
    });
  }
  return { include: collapse(include, tree), exclude };
}

/** Puts a left-out test back. */
export function putBack(items: SuiteItems, nodeid: string): SuiteItems {
  return { include: items.include, exclude: items.exclude.filter((id) => id !== nodeid) };
}

/** Items that name something the catalog no longer has, for "Tests no longer available". */
export function unavailable(items: SuiteItems, tree: TreeModule[]): SelectionItem[] {
  return items.include.filter((item) => testsOf(item, tree).length === 0);
}
