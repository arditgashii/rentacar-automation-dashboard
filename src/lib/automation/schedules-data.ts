// Schedules as the Schedules table shows them.

import { desc, eq, inArray } from "drizzle-orm";

import { type Db, schema } from "@/lib/db";
import { readCatalog } from "./state";
import { describeRule, nextRunAt } from "./schedule";
import { unavailable } from "./suite-selection";
import { buildTree, label, fileLabel } from "./catalog";
import type { RunTarget, SelectionItem } from "./types";

type ScheduleRow = typeof schema.schedules.$inferSelect;

function describeItem(item: SelectionItem): string {
  if (item.kind === "module") return label(item.module);
  if (item.kind === "feature") return `${label(item.module)} / ${label(item.feature)}`;
  if (item.kind === "file") return fileLabel(item.file);
  return "One test";
}

export function describeTarget(target: RunTarget): string {
  if (target.kind === "suite") return `Suite: ${target.suiteName}`;
  return target.selection.length === 1 ? describeItem(target.selection[0]) : `${target.selection.length} areas`;
}

/** The first slot of a new or edited schedule. */
export function firstSlot(row: Pick<ScheduleRow, "repeat" | "days" | "time">, now = new Date()): Date | null {
  return nextRunAt({ repeat: row.repeat, days: row.days, time: row.time }, now);
}

export async function listSchedules(db: Db) {
  const rows = await db.select().from(schema.schedules).orderBy(desc(schema.schedules.createdAt));
  const catalog = await readCatalog(db);
  const tree = buildTree(catalog.tests);
  const suiteIds = rows.flatMap((r) => (r.target.target.kind === "suite" ? [r.target.target.suiteId] : []));
  const suites = suiteIds.length ? await db.select().from(schema.suites).where(inArray(schema.suites.id, suiteIds)) : [];
  const channels = await db.select({ id: schema.teamsChannels.id, name: schema.teamsChannels.name }).from(schema.teamsChannels);
  const lastRunIds = rows.flatMap((r) => (r.lastRunId ? [r.lastRunId] : []));
  const lastRuns = lastRunIds.length
    ? await db
        .select({ id: schema.runs.id, number: schema.runs.number, status: schema.runs.status, passed: schema.runs.passed, flaky: schema.runs.flaky, total: schema.runs.total })
        .from(schema.runs)
        .where(inArray(schema.runs.id, lastRunIds))
    : [];

  return rows.map((row) => {
    const target = row.target.target;
    let testsGone = false;
    if (target.kind === "suite") {
      const suite = suites.find((s) => s.id === target.suiteId);
      testsGone = !suite || (suite.items.include.length > 0 && unavailable(suite.items, tree).length === suite.items.include.length);
    } else {
      testsGone = unavailable({ include: target.selection, exclude: [] }, tree).length === target.selection.length;
    }
    const channel = row.teamsChannelId ? channels.find((c) => c.id === row.teamsChannelId) : null;
    return {
      id: row.id,
      name: row.name,
      target: row.target.target,
      testSet: row.target.testSet,
      includeCostly: row.target.includeCostly,
      whatRuns: `${describeTarget(target)} (${row.target.testSet === "smoke" ? "Smoke" : "Full"})`,
      repeat: row.repeat,
      days: row.days,
      time: row.time,
      repeatText: describeRule({ repeat: row.repeat, days: row.days, time: row.time }, row.nextRunAt),
      paused: row.paused,
      nextRunAt: row.nextRunAt?.toISOString() ?? null,
      missedAt: row.missedAt?.toISOString() ?? null,
      lastRun: lastRuns.find((run) => run.id === row.lastRunId) ?? null,
      teamsChannelId: row.teamsChannelId,
      teamsMode: row.teamsMode,
      teamsBugReports: row.teamsBugReports,
      teams: !row.teamsChannelId ? "Off" : channel ? channel.name : "Channel deleted",
      testsGone,
    };
  });
}

export async function getSchedule(db: Db, id: string) {
  return db.query.schedules.findFirst({ where: eq(schema.schedules.id, id) });
}
