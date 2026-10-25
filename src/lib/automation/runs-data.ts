// Queries behind the Runs page, the Now panel and the run details.

import { and, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";

import { type Db, schema } from "@/lib/db";
import { type PeriodKey, periodRange } from "./period";
import type { RunStatus } from "./types";

type RunRow = typeof schema.runs.$inferSelect;

export type RunCard = {
  id: string;
  number: number;
  name: string;
  status: RunStatus;
  trigger: "on_demand" | "scheduled";
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  knownBug: number;
  progress: RunRow["progress"];
  hasVideo: boolean;
  testSet: "smoke" | "full";
  scheduleName: string | null;
  suiteId: string | null;
  startedBy: string | null;
  errorMessage: string | null;
  source: "real" | "seed";
};

export type RunFilters = {
  started?: "on_demand" | "scheduled";
  module?: string;
  feature?: string;
  status?: string;
  period?: PeriodKey;
  from?: string | null;
  to?: string | null;
  q?: string;
  page: number;
  pageSize: number;
};

export function toCard(run: RunRow, extra: { hasVideo: boolean; scheduleName: string | null; startedBy: string | null }): RunCard {
  return {
    id: run.id,
    number: run.number,
    name: run.name,
    status: run.status,
    trigger: run.trigger,
    queuedAt: run.queuedAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationMs: run.startedAt && run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null,
    total: run.total,
    passed: run.passed,
    failed: run.failed,
    flaky: run.flaky,
    skipped: run.skipped,
    knownBug: run.knownBug,
    progress: run.progress,
    testSet: run.options.testSet,
    suiteId: run.suiteId,
    errorMessage: run.errorMessage,
    source: run.source,
    ...extra,
  };
}

/** Video presence, schedule names and user names for a page of runs, in three small queries. */
export async function cardsFor(db: Db, runs: RunRow[]): Promise<RunCard[]> {
  if (runs.length === 0) return [];
  const ids = runs.map((run) => run.id);
  const withVideo = await db
    .selectDistinct({ runId: schema.runTests.runId })
    .from(schema.runTests)
    .where(and(inArray(schema.runTests.runId, ids), sql`${schema.runTests.media} ? 'video'`));
  const scheduleIds = [...new Set(runs.map((run) => run.scheduleId).filter((id): id is string => Boolean(id)))];
  const schedules = scheduleIds.length
    ? await db.select({ id: schema.schedules.id, name: schema.schedules.name }).from(schema.schedules).where(inArray(schema.schedules.id, scheduleIds))
    : [];
  const userIds = [...new Set(runs.map((run) => run.createdBy).filter((id): id is string => Boolean(id)))];
  const users = userIds.length
    ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, userIds))
    : [];
  const video = new Set(withVideo.map((row) => row.runId));
  return runs.map((run) =>
    toCard(run, {
      hasVideo: video.has(run.id) && !run.mediaDeleted,
      scheduleName: schedules.find((s) => s.id === run.scheduleId)?.name ?? null,
      startedBy: users.find((u) => u.id === run.createdBy)?.name ?? null,
    }),
  );
}

export async function listRuns(db: Db, filters: RunFilters, now = new Date()) {
  const where: SQL[] = [];
  if (filters.started) where.push(eq(schema.runs.trigger, filters.started));
  if (filters.status) where.push(eq(schema.runs.status, filters.status as RunStatus));
  if (filters.period) {
    const range = periodRange(filters.period, now, { from: filters.from ?? null, to: filters.to ?? null });
    if (range) where.push(gte(schema.runs.queuedAt, range.from), lt(schema.runs.queuedAt, range.to));
  }
  if (filters.module) {
    const feature = filters.feature ? sql` and (${schema.runTests.feature} = ${filters.feature} or ${schema.runTests.feature} like ${`${filters.feature}/%`})` : sql``;
    where.push(
      sql`exists (select 1 from ${schema.runTests} where ${schema.runTests.runId} = ${schema.runs.id} and ${schema.runTests.module} = ${filters.module}${feature})`,
    );
  }
  const q = filters.q?.trim().replace(/^#/, "");
  if (q) {
    const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const byNumber = /^\d+$/.test(q) ? [eq(schema.runs.number, Number(q))] : [];
    where.push(
      or(
        ...byNumber,
        ilike(schema.runs.id, pattern),
        ilike(schema.runs.name, pattern),
        sql`exists (select 1 from ${schema.runTests} where ${schema.runTests.runId} = ${schema.runs.id} and (${schema.runTests.title} ilike ${pattern} or ${schema.runTests.testCaseId} ilike ${pattern}))`,
      )!,
    );
  }
  const condition = where.length ? and(...where) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.runs).where(condition);
  const rows = await db
    .select()
    .from(schema.runs)
    .where(condition)
    .orderBy(desc(schema.runs.queuedAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const cards = await cardsFor(db, rows);

  // Group by calendar day of the queue time, newest first.
  const days: { date: string; count: number; runs: RunCard[] }[] = [];
  for (const card of cards) {
    const date = new Date(card.queuedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const day = days.find((d) => d.date === key) ?? (days.push({ date: key, count: 0, runs: [] }), days[days.length - 1]);
    day.runs.push(card);
    day.count += 1;
  }
  return { days, total, page: filters.page, pages: Math.max(1, Math.ceil(total / filters.pageSize)) };
}
