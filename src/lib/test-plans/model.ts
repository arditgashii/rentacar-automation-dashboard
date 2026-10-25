// Test Plans: the tree of projects, suites and folders and the test case list. Pure functions, used by
// the API and the page.

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const STATES = ["draft", "active", "deprecated"] as const;
export const TYPES = ["functional", "ui", "api", "regression", "smoke"] as const;
export const AUTOMATION = ["not_automated", "in_progress", "automated"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type CaseState = (typeof STATES)[number];
export type CaseType = (typeof TYPES)[number];
export type Automation = (typeof AUTOMATION)[number];

export const LABELS: Record<Priority | CaseState | CaseType | Automation, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  draft: "Draft",
  active: "Active",
  deprecated: "Deprecated",
  functional: "Functional",
  ui: "UI",
  api: "API",
  regression: "Regression",
  smoke: "Smoke",
  not_automated: "Not automated",
  in_progress: "In progress",
  automated: "Automated",
};

export type Step = { action: string; expected: string };

export type Project = { id: string; name: string };

export type TreeNode = {
  id: string;
  projectId: string;
  parentId: string | null;
  kind: "suite" | "folder";
  name: string;
  position: number;
};

export type CaseSummary = {
  id: string;
  projectId: string;
  nodeId: string;
  number: number;
  title: string;
  priority: Priority;
  state: CaseState;
  tags: string[];
  automation: Automation;
  updatedAt: string;
};

/** TC-001, TC-012, TC-1204. */
export function caseCode(number: number): string {
  return `TC-${String(number).padStart(3, "0")}`;
}

/** Suites of a project (parentId null) or the folders inside a node, in their order. */
export function childrenOf(nodes: TreeNode[], projectId: string, parentId: string | null): TreeNode[] {
  return nodes
    .filter((n) => n.projectId === projectId && n.parentId === parentId)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

/** The node and everything below it. */
export function subtreeIds(nodes: TreeNode[], id: string): string[] {
  const ids = [id];
  for (let i = 0; i < ids.length; i++) {
    for (const node of nodes) if (node.parentId === ids[i]) ids.push(node.id);
  }
  return ids;
}

/** Number of test cases in each node, folders below it included. */
export function countByNode(nodes: TreeNode[], cases: Pick<CaseSummary, "nodeId">[]): Map<string, number> {
  const direct = new Map<string, number>();
  for (const c of cases) direct.set(c.nodeId, (direct.get(c.nodeId) ?? 0) + 1);
  const parent = new Map(nodes.map((n) => [n.id, n.parentId]));
  const counts = new Map<string, number>();
  for (const [nodeId, count] of direct) {
    for (let id: string | null | undefined = nodeId; id; id = parent.get(id)) counts.set(id, (counts.get(id) ?? 0) + count);
  }
  return counts;
}

/** The nodes from the suite down to this node. */
export function pathOf(nodes: TreeNode[], id: string): TreeNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: TreeNode[] = [];
  for (let node = byId.get(id); node; node = node.parentId ? byId.get(node.parentId) : undefined) path.unshift(node);
  return path;
}

/** Title, ID ("tc-5", "TC-005" or "5") or a tag. */
export function matchesSearch(c: Pick<CaseSummary, "number" | "title" | "tags">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const code = caseCode(c.number).toLowerCase();
  const digits = /^(?:tc-?)?0*(\d+)$/.exec(q)?.[1];
  if (digits && String(c.number) === digits) return true;
  return c.title.toLowerCase().includes(q) || code.includes(q) || c.tags.some((tag) => tag.toLowerCase().includes(q));
}

/** Tags typed as "a, b ,a" become ["a", "b"]. */
export function parseTags(value: string): string[] {
  return [...new Set(value.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 20);
}

/** CSV that opens cleanly in Excel: quoted cells, and a leading = + - @ cannot start a formula. */
export function toCsv(rows: string[][]): string {
  const cell = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
