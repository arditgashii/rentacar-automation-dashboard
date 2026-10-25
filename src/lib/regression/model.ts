// Manual Regression runs on the page: the module / feature / function tree, counts, filters and Jira
// links. Pure functions, used by the API and the page.

export type Result = "not_tested" | "passed" | "failed" | "blocked";
export type ItemKind = "module" | "feature" | "function" | "story" | "task" | "bug";

export const RESULT_LABELS: Record<Result, string> = { not_tested: "Not tested", passed: "Passed", failed: "Failed", blocked: "Blocked" };
export const SPRINT_KINDS = ["story", "task", "bug"] as const;
export const KIND_LABELS: Record<ItemKind, string> = { module: "Module", feature: "Feature", function: "Function", story: "Story", task: "Task", bug: "Bug" };

export type Item = {
  id: string;
  parentId: string | null;
  libraryId: string | null;
  kind: ItemKind;
  name: string;
  jira: string;
  position: number;
  result: Result;
  comment: string;
  removedFromLibrary: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type Counts = Record<Result, number> & { total: number };

/** Items that get a result: functions in a regression run, every item in a sprint run. */
export function isTestable(item: Pick<Item, "kind">): boolean {
  return item.kind !== "module" && item.kind !== "feature";
}

export function countResults(items: Pick<Item, "kind" | "result">[]): Counts {
  const counts: Counts = { not_tested: 0, passed: 0, failed: 0, blocked: 0, total: 0 };
  for (const item of items) {
    if (!isTestable(item)) continue;
    counts[item.result]++;
    counts.total++;
  }
  return counts;
}

/** Children of a node (or the top level) in their order. */
export function childrenOf<T extends Pick<Item, "parentId" | "position" | "name">>(items: T[], parentId: string | null): T[] {
  return items.filter((i) => i.parentId === parentId).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

/** All functions below a module or feature. */
export function functionsBelow(items: Item[], id: string): Item[] {
  const below: Item[] = [];
  const walk = (parentId: string) => {
    for (const child of items) {
      if (child.parentId !== parentId) continue;
      if (isTestable(child)) below.push(child);
      else walk(child.id);
    }
  };
  walk(id);
  return below;
}

export type Filter = "all" | Result;

/** Does a testable item pass the quick filter and the search? Search matches the item, its feature and module. */
export function visible(item: Item, items: Item[], filter: Filter, query: string): boolean {
  if (filter !== "all" && item.result !== filter) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const byId = new Map(items.map((i) => [i.id, i]));
  for (let node: Item | undefined = item; node; node = node.parentId ? byId.get(node.parentId) : undefined) {
    if (node.name.toLowerCase().includes(q) || node.comment.toLowerCase().includes(q) || node.jira.toLowerCase().includes(q)) return true;
  }
  return false;
}

/** The state colour of a group: failed beats blocked beats not tested; all passed is passed. */
export function groupTone(counts: Counts): "fail" | "flaky" | "pass" | "skip" {
  if (counts.failed) return "fail";
  if (counts.blocked) return "flaky";
  if (counts.total && counts.passed === counts.total) return "pass";
  return "skip";
}

const JIRA_KEY = /^[A-Z][A-Z0-9]{1,9}-\d{1,6}$/;
const JIRA_URL = /^https?:\/\/[^\s/]+(?:\/[^\s]*)?\/browse\/([A-Z][A-Z0-9]{1,9}-\d{1,6})\/?$/;

/** "dn-1234", "DN-1234" or a Jira browse URL become the key or the URL; anything else is null. */
export function parseJira(value: string): string | null {
  const v = value.trim();
  if (JIRA_KEY.test(v.toUpperCase()) && !v.includes("/")) return v.toUpperCase();
  if (JIRA_URL.test(v)) return v;
  return null;
}

/** The link of a Jira value: a URL stays as it is, a key goes after the base URL. */
export function jiraHref(value: string, baseUrl: string): string {
  return /^https?:\/\//.test(value) ? value : `${baseUrl.replace(/\/?$/, "/")}${value}`;
}

/** The key shown for a Jira value ("DN-1234" also for a full URL). */
export function jiraLabel(value: string): string {
  return JIRA_URL.exec(value)?.[1] ?? value;
}

export type Segment = { text: string; href?: string };

/** Splits a comment into text and links: URLs and Jira keys (DN-1234) become links. */
export function linkify(text: string, baseUrl: string): Segment[] {
  const pattern = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])|\b([A-Z][A-Z0-9]{1,9}-\d{1,6})\b/g;
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: text.slice(last, index) });
    segments.push({ text: match[0], href: match[1] ? match[1] : jiraHref(match[2], baseUrl) });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}
