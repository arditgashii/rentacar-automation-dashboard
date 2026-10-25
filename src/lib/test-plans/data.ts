// Test Plans in the database. Deleting never removes rows: everything deleted together gets one
// batch id, the Deleted list shows one line per batch and Restore brings the whole batch back.

import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { HttpError } from "@/lib/auth/guards";
import { type Db, db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { type CaseSummary, caseCode, childrenOf, type TreeNode } from "./model";
import type { ExportFile, ExportNode } from "./validation";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const live = {
  project: isNull(schema.tpProjects.deletedAt),
  node: isNull(schema.tpNodes.deletedAt),
  case: isNull(schema.tpCases.deletedAt),
};

export async function loadWorkspace() {
  const projects = await db.select({ id: schema.tpProjects.id, name: schema.tpProjects.name }).from(schema.tpProjects).where(live.project).orderBy(asc(schema.tpProjects.createdAt));
  const nodes: TreeNode[] = await db
    .select({ id: schema.tpNodes.id, projectId: schema.tpNodes.projectId, parentId: schema.tpNodes.parentId, kind: schema.tpNodes.kind, name: schema.tpNodes.name, position: schema.tpNodes.position })
    .from(schema.tpNodes)
    .where(live.node);
  const rows = await db
    .select({
      id: schema.tpCases.id,
      projectId: schema.tpCases.projectId,
      nodeId: schema.tpCases.nodeId,
      number: schema.tpCases.number,
      title: schema.tpCases.title,
      priority: schema.tpCases.priority,
      state: schema.tpCases.state,
      tags: schema.tpCases.tags,
      automation: schema.tpCases.automation,
      updatedAt: schema.tpCases.updatedAt,
    })
    .from(schema.tpCases)
    .where(live.case);
  const cases: CaseSummary[] = rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
  return { projects, nodes, cases };
}

export async function liveNode(id: string) {
  const node = await db.query.tpNodes.findFirst({ where: and(eq(schema.tpNodes.id, id), live.node) });
  if (!node) throw new HttpError(404, "This suite or folder was deleted.");
  return node;
}

export async function liveCase(id: string) {
  const row = await db.query.tpCases.findFirst({ where: and(eq(schema.tpCases.id, id), live.case) });
  if (!row) throw new HttpError(404, "Test case not found. It may have been deleted.");
  return row;
}

/** The next TC number of a project. Taken in one statement, so two saves never get the same number. */
export async function takeNumber(tx: Tx | Db, projectId: string): Promise<number> {
  const [row] = await tx
    .update(schema.tpProjects)
    .set({ nextNumber: sql`${schema.tpProjects.nextNumber} + 1` })
    .where(eq(schema.tpProjects.id, projectId))
    .returning({ next: schema.tpProjects.nextNumber });
  if (!row) throw new HttpError(404, "Project not found.");
  return row.next - 1;
}

/** Pass or Fail of the latest automation run that ran a test with this TC ID. */
export async function latestResult(number: number) {
  const [row] = await db
    .select({ outcome: schema.runTests.outcome, runId: schema.runs.id, runNumber: schema.runs.number, at: schema.runs.startedAt })
    .from(schema.runTests)
    .innerJoin(schema.runs, eq(schema.runs.id, schema.runTests.runId))
    .where(and(eq(schema.runTests.testCaseId, caseCode(number)), inArray(schema.runTests.outcome, ["passed", "flaky", "failed", "known_bug"])))
    .orderBy(desc(schema.runs.startedAt))
    .limit(1);
  if (!row) return null;
  return { passed: row.outcome === "passed" || row.outcome === "flaky", outcome: row.outcome, runId: row.runId, runNumber: row.runNumber, at: row.at?.toISOString() ?? null };
}

export async function caseDetails(id: string) {
  const row = await liveCase(id);
  const attachments = await db
    .select({ id: schema.tpAttachments.id, filename: schema.tpAttachments.filename, mime: schema.tpAttachments.mime, size: schema.tpAttachments.size, createdAt: schema.tpAttachments.createdAt })
    .from(schema.tpAttachments)
    .where(eq(schema.tpAttachments.caseId, id))
    .orderBy(asc(schema.tpAttachments.createdAt));
  const people = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  const nameOf = (userId: string | null) => people.find((p) => p.id === userId)?.name ?? null;
  return {
    case: {
      id: row.id,
      projectId: row.projectId,
      nodeId: row.nodeId,
      number: row.number,
      title: row.title,
      state: row.state,
      priority: row.priority,
      tags: row.tags,
      description: row.description,
      preconditions: row.preconditions,
      steps: row.steps,
      type: row.type,
      automation: row.automation,
      automatedTest: row.automatedTest,
      createdBy: nameOf(row.createdBy),
      updatedBy: nameOf(row.updatedBy),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    attachments: attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    latestResult: await latestResult(row.number),
  };
}

// Deleting

async function liveNodesOf(projectId: string) {
  return db.select().from(schema.tpNodes).where(and(eq(schema.tpNodes.projectId, projectId), live.node));
}

export async function deleteProject(projectId: string) {
  const batch = newId("del");
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(schema.tpProjects).set({ deletedAt: now, deletedBatch: batch }).where(and(eq(schema.tpProjects.id, projectId), live.project));
    await tx.update(schema.tpNodes).set({ deletedAt: now, deletedBatch: batch }).where(and(eq(schema.tpNodes.projectId, projectId), live.node));
    await tx.update(schema.tpCases).set({ deletedAt: now, deletedBatch: batch }).where(and(eq(schema.tpCases.projectId, projectId), live.case));
  });
}

/** Deletes the node, its folders and their test cases. Returns what went to Deleted. */
export async function deleteNode(nodeId: string) {
  const node = await liveNode(nodeId);
  const nodes = await liveNodesOf(node.projectId);
  const ids = [nodeId];
  for (let i = 0; i < ids.length; i++) for (const n of nodes) if (n.parentId === ids[i]) ids.push(n.id);
  const batch = newId("del");
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    await tx.update(schema.tpNodes).set({ deletedAt: now, deletedBatch: batch }).where(inArray(schema.tpNodes.id, ids));
    const cases = await tx
      .update(schema.tpCases)
      .set({ deletedAt: now, deletedBatch: batch })
      .where(and(inArray(schema.tpCases.nodeId, ids), live.case))
      .returning({ id: schema.tpCases.id });
    return { folders: ids.length - 1, cases: cases.length };
  });
  return result;
}

export async function deleteCases(ids: string[]) {
  const batch = newId("del");
  const deleted = await db
    .update(schema.tpCases)
    .set({ deletedAt: new Date(), deletedBatch: batch })
    .where(and(inArray(schema.tpCases.id, ids), live.case))
    .returning({ id: schema.tpCases.id });
  return deleted.length;
}

export type DeletedItem = { batch: string; kind: "project" | "suite" | "folder" | "cases"; name: string; deletedAt: string; folders: number; cases: number };

/** One line per delete, newest first. */
export async function listDeleted(): Promise<DeletedItem[]> {
  const projects = await db.select().from(schema.tpProjects).where(isNotNull(schema.tpProjects.deletedBatch));
  const nodes = await db.select().from(schema.tpNodes).where(isNotNull(schema.tpNodes.deletedBatch));
  const cases = await db
    .select({ id: schema.tpCases.id, number: schema.tpCases.number, title: schema.tpCases.title, batch: schema.tpCases.deletedBatch, at: schema.tpCases.deletedAt })
    .from(schema.tpCases)
    .where(isNotNull(schema.tpCases.deletedBatch));
  const batches = new Set([...projects, ...nodes].map((r) => r.deletedBatch!).concat(cases.map((c) => c.batch!)));
  const items: DeletedItem[] = [];
  for (const batch of batches) {
    const project = projects.find((p) => p.deletedBatch === batch);
    const batchNodes = nodes.filter((n) => n.deletedBatch === batch);
    const batchCases = cases.filter((c) => c.batch === batch);
    const root = batchNodes.find((n) => !batchNodes.some((other) => other.id === n.parentId));
    const at = (project?.deletedAt ?? root?.deletedAt ?? batchCases[0]?.at ?? new Date()).toISOString();
    if (project) items.push({ batch, kind: "project", name: project.name, deletedAt: at, folders: batchNodes.length, cases: batchCases.length });
    else if (root) items.push({ batch, kind: root.kind, name: root.name, deletedAt: at, folders: batchNodes.length - 1, cases: batchCases.length });
    else {
      const name = batchCases.length === 1 ? `${caseCode(batchCases[0].number)} ${batchCases[0].title}` : `${batchCases.length} test cases`;
      items.push({ batch, kind: "cases", name, deletedAt: at, folders: 0, cases: batchCases.length });
    }
  }
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export async function restore(batch: string) {
  const project = await db.query.tpProjects.findFirst({ where: eq(schema.tpProjects.deletedBatch, batch) });
  const nodes = await db.select().from(schema.tpNodes).where(eq(schema.tpNodes.deletedBatch, batch));
  const cases = await db.select({ nodeId: schema.tpCases.nodeId, projectId: schema.tpCases.projectId }).from(schema.tpCases).where(eq(schema.tpCases.deletedBatch, batch));
  if (!project && !nodes.length && !cases.length) throw new HttpError(404, "Nothing to restore. It may have been restored already.");

  if (!project) {
    const projectIds = [...new Set([...nodes.map((n) => n.projectId), ...cases.map((c) => c.projectId)])];
    const deletedProject = await db.query.tpProjects.findFirst({ where: and(inArray(schema.tpProjects.id, projectIds), isNotNull(schema.tpProjects.deletedAt)) });
    if (deletedProject) throw new HttpError(409, `Restore the project ${deletedProject.name} first.`);
    // The parents outside this batch must be there.
    const inBatch = new Set(nodes.map((n) => n.id));
    const needed = [...new Set([...nodes.map((n) => n.parentId).filter((id): id is string => !!id && !inBatch.has(id)), ...cases.map((c) => c.nodeId).filter((id) => !inBatch.has(id))])];
    if (needed.length) {
      const gone = await db.select({ id: schema.tpNodes.id }).from(schema.tpNodes).where(and(inArray(schema.tpNodes.id, needed), isNotNull(schema.tpNodes.deletedAt)));
      if (gone.length) throw new HttpError(409, "Restore its folder first.");
    }
  }

  await db.transaction(async (tx) => {
    const clear = { deletedAt: null, deletedBatch: null };
    await tx.update(schema.tpProjects).set(clear).where(eq(schema.tpProjects.deletedBatch, batch));
    await tx.update(schema.tpNodes).set(clear).where(eq(schema.tpNodes.deletedBatch, batch));
    await tx.update(schema.tpCases).set(clear).where(eq(schema.tpCases.deletedBatch, batch));
  });
}

// Moving

/** Swaps a suite or folder with its neighbour. Positions are renumbered so they stay 0, 1, 2, ... */
export async function moveNode(nodeId: string, direction: "up" | "down") {
  const node = await liveNode(nodeId);
  const nodes = (await liveNodesOf(node.projectId)) as TreeNode[];
  const siblings = childrenOf(nodes, node.projectId, node.parentId);
  const index = siblings.findIndex((s) => s.id === nodeId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= siblings.length) return;
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  await db.transaction(async (tx) => {
    for (const [position, sibling] of siblings.entries()) {
      await tx.update(schema.tpNodes).set({ position }).where(eq(schema.tpNodes.id, sibling.id));
    }
  });
}

export async function nextPosition(projectId: string, parentId: string | null) {
  const [row] = await db
    .select({ max: sql<number | null>`max(${schema.tpNodes.position})` })
    .from(schema.tpNodes)
    .where(and(eq(schema.tpNodes.projectId, projectId), parentId ? eq(schema.tpNodes.parentId, parentId) : isNull(schema.tpNodes.parentId), live.node));
  return (row?.max ?? -1) + 1;
}

// Export and import

export async function exportAll(): Promise<ExportFile> {
  const { projects, nodes } = await loadWorkspace();
  const projectRows = await db.select().from(schema.tpProjects).where(live.project);
  const cases = await db.select().from(schema.tpCases).where(live.case).orderBy(asc(schema.tpCases.number));
  const build = (projectId: string, node: TreeNode): ExportNode => ({
    name: node.name,
    cases: cases
      .filter((c) => c.nodeId === node.id)
      .map((c) => ({
        number: c.number,
        title: c.title,
        state: c.state,
        priority: c.priority,
        tags: c.tags,
        description: c.description,
        preconditions: c.preconditions,
        steps: c.steps,
        type: c.type,
        automation: c.automation,
        automatedTest: c.automatedTest,
      })),
    folders: childrenOf(nodes, projectId, node.id).map((child) => build(projectId, child)),
  });
  return {
    format: "drivenow-test-plans",
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: projects.map((p) => ({
      name: p.name,
      nextNumber: projectRows.find((row) => row.id === p.id)?.nextNumber ?? 1,
      suites: childrenOf(nodes, p.id, null).map((suite) => build(p.id, suite)),
    })),
  };
}

/** Adds every project of the file as a new project ("DriveNow (imported)" when the name is taken). */
export async function importFile(file: ExportFile, userId: string) {
  const report = { projects: 0, suites: 0, folders: 0, cases: 0 };
  const taken = new Set((await db.select({ name: schema.tpProjects.name }).from(schema.tpProjects).where(live.project)).map((p) => p.name.toLowerCase()));
  await db.transaction(async (tx) => {
    for (const project of file.projects) {
      let name = project.name;
      for (let i = 1; taken.has(name.toLowerCase()); i++) name = `${project.name} (imported${i > 1 ? ` ${i}` : ""})`;
      taken.add(name.toLowerCase());
      const projectId = newId("prj");
      let maxNumber = 0;
      const numbers = new Set<number>();
      let temporary = 0;
      await tx.insert(schema.tpProjects).values({ id: projectId, name });
      report.projects++;
      const add = async (node: ExportNode, parentId: string | null, position: number) => {
        const id = newId("nod");
        await tx.insert(schema.tpNodes).values({ id, projectId, parentId, kind: parentId ? "folder" : "suite", name: node.name, position });
        if (parentId) report.folders++;
        else report.suites++;
        for (const c of node.cases) {
          // A number that is used twice in the file gets a new one at the end.
          const number = numbers.has(c.number) ? 0 : c.number;
          if (number) numbers.add(number);
          maxNumber = Math.max(maxNumber, number);
          await tx.insert(schema.tpCases).values({ id: newId("tcs"), projectId, nodeId: id, ...c, number: number || --temporary, createdBy: userId, updatedBy: userId });
          report.cases++;
        }
        for (const [index, child] of node.folders.entries()) await add(child, id, index);
      };
      for (const [index, suite] of project.suites.entries()) await add(suite, null, index);
      // Cases that had a duplicate number are numbered after the highest one.
      const renumber = await tx.select({ id: schema.tpCases.id }).from(schema.tpCases).where(and(eq(schema.tpCases.projectId, projectId), sql`${schema.tpCases.number} < 0`)).orderBy(desc(schema.tpCases.number));
      let next = Math.max(maxNumber, project.nextNumber - 1) + 1;
      for (const row of renumber) await tx.update(schema.tpCases).set({ number: next++ }).where(eq(schema.tpCases.id, row.id));
      await tx.update(schema.tpProjects).set({ nextNumber: next }).where(eq(schema.tpProjects.id, projectId));
    }
  });
  return report;
}

/** An id from the URL, or a 404 for anything this app did not create. */
export async function idFrom(params: Promise<Record<string, string>>, key: string, prefix: string): Promise<string> {
  const value = (await params)[key];
  if (!/^[a-z]{3}_[0-9a-z]{10}$/.test(value ?? "") || !value.startsWith(`${prefix}_`)) throw new HttpError(404, "Not found.");
  return value;
}

/** Same name next to it (case does not matter) is refused. */
export async function assertFreeName(projectId: string, parentId: string | null, name: string, exceptId?: string) {
  const siblings = await db
    .select({ id: schema.tpNodes.id, name: schema.tpNodes.name })
    .from(schema.tpNodes)
    .where(and(eq(schema.tpNodes.projectId, projectId), parentId ? eq(schema.tpNodes.parentId, parentId) : isNull(schema.tpNodes.parentId), live.node));
  const taken = siblings.find((s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase());
  if (taken) throw new HttpError(409, `"${taken.name}" already exists here.`);
}
