// Manual Regression in the database: runs, their items, the history of every change and the library
// new runs copy.

import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { HttpError } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import type { RegressionKind } from "./library";
import { countResults, type Item, parseJira, type Result } from "./model";
import { copyLibraryIntoRun } from "./runs";

type RunRow = typeof schema.regRuns.$inferSelect;
type ItemRow = typeof schema.regItems.$inferSelect;

async function userNames(): Promise<Map<string, string>> {
  const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  return new Map(users.map((u) => [u.id, u.name]));
}

/** Runs of one kind, team and environment, newest first, with their counts. */
export async function listRuns(kind: RegressionKind, team: string, environment: string) {
  const runs = await db
    .select()
    .from(schema.regRuns)
    .where(and(eq(schema.regRuns.kind, kind), eq(schema.regRuns.team, team), eq(schema.regRuns.environment, environment)))
    .orderBy(desc(schema.regRuns.startedAt));
  const items = runs.length
    ? await db.select({ runId: schema.regItems.runId, kind: schema.regItems.kind, result: schema.regItems.result }).from(schema.regItems).where(inArray(schema.regItems.runId, runs.map((r) => r.id)))
    : [];
  return runs.map((run) => ({
    id: run.id,
    name: run.name,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    counts: countResults(items.filter((i) => i.runId === run.id)),
  }));
}

/** "v1.2" and "V1.2" are the same run: the name is matched without case. */
export async function openOrCreateRun(input: { kind: RegressionKind; team: string; environment: string; name: string }, userId: string) {
  const nameKey = input.name.toLowerCase();
  const where = and(eq(schema.regRuns.kind, input.kind), eq(schema.regRuns.team, input.team), eq(schema.regRuns.environment, input.environment), eq(schema.regRuns.nameKey, nameKey));
  const existing = await db.query.regRuns.findFirst({ where });
  if (existing) return { id: existing.id, name: existing.name, created: false };
  const id = newId("rgr");
  const inserted = await db
    .insert(schema.regRuns)
    .values({ id, ...input, nameKey, startedBy: userId })
    .onConflictDoNothing()
    .returning({ id: schema.regRuns.id });
  if (!inserted.length) {
    // Someone created it at the same moment: open theirs.
    const theirs = await db.query.regRuns.findFirst({ where });
    return { id: theirs!.id, name: theirs!.name, created: false };
  }
  if (input.kind !== "sprint") await copyLibraryIntoRun(db, id, input.team);
  return { id, name: input.name, created: true };
}

export async function findRun(id: string): Promise<RunRow> {
  if (!/^rgr_[0-9a-z]{10}$/.test(id)) throw new HttpError(404, "Run not found.");
  const run = await db.query.regRuns.findFirst({ where: eq(schema.regRuns.id, id) });
  if (!run) throw new HttpError(404, "Run not found.");
  return run;
}

export function assertOpen(run: RunRow) {
  if (run.status === "completed") throw new HttpError(409, "This run is completed. Reopen it to make changes.");
}

export async function findItem(id: string): Promise<{ item: ItemRow; run: RunRow }> {
  if (!/^itm_[0-9a-z]{10}$/.test(id)) throw new HttpError(404, "Item not found.");
  const item = await db.query.regItems.findFirst({ where: eq(schema.regItems.id, id) });
  if (!item) throw new HttpError(404, "Item not found. It may have been removed.");
  return { item, run: await findRun(item.runId) };
}

function toItem(row: ItemRow, names: Map<string, string>): Item {
  return {
    id: row.id,
    parentId: row.parentId,
    libraryId: row.libraryId,
    kind: row.kind,
    name: row.name,
    jira: row.jira,
    position: row.position,
    result: row.result,
    comment: row.comment,
    removedFromLibrary: row.removedFromLibrary,
    updatedBy: row.updatedBy ? (names.get(row.updatedBy) ?? "A removed user") : null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function runDetails(id: string) {
  const run = await findRun(id);
  const names = await userNames();
  const rows = await db.select().from(schema.regItems).where(eq(schema.regItems.runId, id)).orderBy(asc(schema.regItems.position));
  return {
    run: {
      id: run.id,
      kind: run.kind,
      team: run.team,
      environment: run.environment,
      name: run.name,
      status: run.status,
      startedBy: run.startedBy ? (names.get(run.startedBy) ?? null) : null,
      startedAt: run.startedAt.toISOString(),
      completedBy: run.completedBy ? (names.get(run.completedBy) ?? null) : null,
      completedAt: run.completedAt?.toISOString() ?? null,
    },
    items: rows.map((row) => toItem(row, names)),
  };
}

/** Saves a change and writes one history line per changed field. Returns when it was last changed. */
export async function changeItem(itemId: string, patch: { result?: Result; comment?: string; name?: string; jira?: string; kind?: "story" | "task" | "bug" }, userId: string) {
  const { item, run } = await findItem(itemId);
  assertOpen(run);
  const sprintItem = item.kind === "story" || item.kind === "task" || item.kind === "bug";
  if (patch.result && (item.kind === "module" || item.kind === "feature")) throw new HttpError(400, "Only functions get a result.");
  if ((patch.jira !== undefined || patch.kind) && !sprintItem) throw new HttpError(400, "Only sprint items have a type and a Jira link.");
  let jira = patch.jira;
  if (jira !== undefined && jira !== "") {
    const parsed = parseJira(jira);
    if (!parsed) throw new HttpError(400, "Use a Jira key like DN-1234 or a full Jira link.");
    jira = parsed;
  }
  const next = { result: patch.result, comment: patch.comment, name: patch.name, jira, kind: patch.kind };
  const history: (typeof schema.regHistory.$inferInsert)[] = [];
  for (const field of ["result", "comment", "name", "jira"] as const) {
    const value = next[field];
    if (value !== undefined && value !== item[field]) history.push({ itemId, userId, field, oldValue: item[field], newValue: value });
  }
  const kindChanged = patch.kind !== undefined && patch.kind !== item.kind;
  if (!history.length && !kindChanged) return { updatedAt: item.updatedAt?.toISOString() ?? null, changed: false };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.regItems)
      .set({
        ...(next.result !== undefined ? { result: next.result } : {}),
        ...(next.comment !== undefined ? { comment: next.comment } : {}),
        ...(next.name !== undefined ? { name: next.name } : {}),
        ...(next.jira !== undefined ? { jira: next.jira } : {}),
        ...(kindChanged ? { kind: patch.kind } : {}),
        updatedBy: userId,
        updatedAt: now,
      })
      .where(eq(schema.regItems.id, itemId));
    if (history.length) await tx.insert(schema.regHistory).values(history);
    // A rename also renames the library entry, so future runs get the new name.
    if (next.name !== undefined && item.libraryId && !item.removedFromLibrary) {
      await tx.update(schema.regLibrary).set({ name: next.name }).where(eq(schema.regLibrary.id, item.libraryId));
    }
  });
  return { updatedAt: now.toISOString(), changed: true };
}

const PARENT_KIND: Record<string, "module" | "feature" | null> = { module: null, feature: "module", function: "feature", story: null, task: null, bug: null };

/** Adds an item to the run, and to the library when asked ("Also add to future runs"). */
export async function addItem(runId: string, input: { kind: ItemRow["kind"]; parentId: string | null; name: string; jira: string; alsoLibrary: boolean }, userId: string) {
  const run = await findRun(runId);
  assertOpen(run);
  const sprint = run.kind === "sprint";
  const sprintKind = input.kind === "story" || input.kind === "task" || input.kind === "bug";
  if (sprint !== sprintKind) throw new HttpError(400, sprint ? "A sprint run has stories, tasks and bugs." : "A regression run has modules, features and functions.");

  let parent: ItemRow | undefined;
  const parentKind = PARENT_KIND[input.kind];
  if (parentKind) {
    parent = input.parentId ? await db.query.regItems.findFirst({ where: and(eq(schema.regItems.id, input.parentId), eq(schema.regItems.runId, runId)) }) : undefined;
    if (!parent || parent.kind !== parentKind) throw new HttpError(400, `A ${input.kind} goes inside a ${parentKind}.`);
  } else if (input.parentId) {
    throw new HttpError(400, `A ${input.kind} goes at the top.`);
  }

  let jira = "";
  if (sprintKind) {
    const parsed = parseJira(input.jira);
    if (!parsed) throw new HttpError(400, "Use a Jira key like DN-1234 or a full Jira link.");
    jira = parsed;
  }

  const [{ max }] = await db
    .select({ max: sql<number | null>`max(${schema.regItems.position})` })
    .from(schema.regItems)
    .where(and(eq(schema.regItems.runId, runId), parent ? eq(schema.regItems.parentId, parent.id) : sql`${schema.regItems.parentId} is null`));
  const position = (max ?? -1) + 1;

  let libraryId: string | null = null;
  if (input.alsoLibrary && !sprint) {
    if (parent && (!parent.libraryId || parent.removedFromLibrary)) throw new HttpError(400, `The ${parent.kind} is not in the library, so this cannot be added to future runs.`);
    libraryId = newId("lib");
  }

  const id = newId("itm");
  await db.transaction(async (tx) => {
    if (libraryId) {
      const [{ max: libMax }] = await tx
        .select({ max: sql<number | null>`max(${schema.regLibrary.position})` })
        .from(schema.regLibrary)
        .where(and(eq(schema.regLibrary.team, run.team), parent?.libraryId ? eq(schema.regLibrary.parentId, parent.libraryId) : sql`${schema.regLibrary.parentId} is null`));
      await tx.insert(schema.regLibrary).values({ id: libraryId, team: run.team, parentId: parent?.libraryId ?? null, kind: input.kind as "module", name: input.name, position: (libMax ?? -1) + 1 });
    }
    await tx.insert(schema.regItems).values({ id, runId, libraryId, parentId: parent?.id ?? null, kind: input.kind, name: input.name, jira, position, updatedBy: userId, updatedAt: new Date() });
  });
  return id;
}

/** The library entry (and what is below it) stops going into new runs; this run keeps its results. */
export async function removeFromLibrary(itemId: string) {
  const { item, run } = await findItem(itemId);
  assertOpen(run);
  if (!item.libraryId || item.removedFromLibrary) throw new HttpError(400, "This item is not in the library.");
  const library = await db.select({ id: schema.regLibrary.id, parentId: schema.regLibrary.parentId }).from(schema.regLibrary).where(eq(schema.regLibrary.team, run.team));
  const libraryIds = [item.libraryId];
  for (let i = 0; i < libraryIds.length; i++) for (const row of library) if (row.parentId === libraryIds[i]) libraryIds.push(row.id);
  const runItems = await db.select({ id: schema.regItems.id, parentId: schema.regItems.parentId }).from(schema.regItems).where(eq(schema.regItems.runId, run.id));
  const itemIds = [item.id];
  for (let i = 0; i < itemIds.length; i++) for (const row of runItems) if (row.parentId === itemIds[i]) itemIds.push(row.id);
  await db.transaction(async (tx) => {
    await tx.update(schema.regLibrary).set({ removed: true }).where(inArray(schema.regLibrary.id, libraryIds));
    await tx.update(schema.regItems).set({ removedFromLibrary: true }).where(inArray(schema.regItems.id, itemIds));
  });
}

/** Sprint items can be removed from their run. */
export async function deleteItem(itemId: string) {
  const { item, run } = await findItem(itemId);
  assertOpen(run);
  if (run.kind !== "sprint") throw new HttpError(400, "Regression items are not deleted; use Remove from library.");
  await db.delete(schema.regItems).where(eq(schema.regItems.id, item.id));
}

export async function itemHistory(itemId: string) {
  await findItem(itemId);
  const names = await userNames();
  const rows = await db.select().from(schema.regHistory).where(eq(schema.regHistory.itemId, itemId)).orderBy(desc(schema.regHistory.at), desc(schema.regHistory.id)).limit(200);
  return rows.map((row) => ({
    id: row.id,
    field: row.field,
    oldValue: row.oldValue,
    newValue: row.newValue,
    by: row.userId ? (names.get(row.userId) ?? "A removed user") : "Someone",
    at: row.at.toISOString(),
  }));
}

export async function setRunStatus(runId: string, status: "open" | "completed", userId: string) {
  const run = await findRun(runId);
  if (run.status === status) return;
  await db
    .update(schema.regRuns)
    .set(status === "completed" ? { status, completedBy: userId, completedAt: new Date() } : { status, completedBy: null, completedAt: null })
    .where(eq(schema.regRuns.id, run.id));
}
