// Teams messages after a scheduled run: the results, and a bug report per failed test when asked.

import { and, eq, inArray } from "drizzle-orm";

import { buildBugReport } from "@/lib/automation/bug-report";
import { describeRule } from "@/lib/automation/schedule";
import { DEFAULT_TEMPLATES, renderTemplate } from "@/lib/automation/teams";
import { postToTeams } from "@/lib/automation/teams-send";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

type Run = typeof schema.runs.$inferSelect;

const STATUS_WORDS: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  stopped: "Stopped",
  error: "Error",
  not_ready: "Not ready",
};

export function duration(run: Pick<Run, "startedAt" | "finishedAt">): string {
  if (!run.startedAt || !run.finishedAt) return "";
  const seconds = Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

async function channels() {
  const settings = await db.query.teamsSettings.findFirst();
  const all = await db.select().from(schema.teamsChannels);
  return { settings, byId: new Map(all.map((channel) => [channel.id, channel])) };
}

export async function notifyRunFinished(run: Run): Promise<void> {
  if (run.trigger !== "scheduled" || !run.scheduleId) return;
  const schedule = await db.query.schedules.findFirst({ where: eq(schema.schedules.id, run.scheduleId) });
  if (!schedule?.teamsChannelId) return;
  const { settings, byId } = await channels();
  const failed = run.status !== "passed";
  // With the morning summary on, scheduled runs only post right away when they fail.
  if ((schedule.teamsMode === "failures" || settings?.morningEnabled) && !failed) return;

  const resultsChannel = byId.get(settings?.twoChannels && settings.resultsChannelId ? settings.resultsChannelId : schedule.teamsChannelId);
  const bugsChannel = byId.get(settings?.twoChannels && settings.bugsChannelId ? settings.bugsChannelId : schedule.teamsChannelId);
  const link = `${env.appUrl}/automation-test/runs/${run.id}`;
  const scheduleText = describeRule({ repeat: schedule.repeat, days: schedule.days, time: schedule.time }, run.startedAt);
  const tests = await db.select().from(schema.runTests).where(eq(schema.runTests.runId, run.id));
  const failedTests = tests.filter((test) => test.outcome === "failed");

  if (resultsChannel) {
    const text = renderTemplate(settings?.resultsTemplate || DEFAULT_TEMPLATES.results, {
      status: STATUS_WORDS[run.status] ?? run.status,
      name: schedule.name,
      total: String(run.total),
      passed: String(run.passed + run.flaky),
      failed: String(run.failed),
      flaky: String(run.flaky),
      knownBugs: String(run.knownBug),
      skipped: String(run.skipped),
      duration: duration(run),
      schedule: scheduleText,
      commit: run.platformCommit?.slice(0, 7) ?? "",
      failedTests: failedTests.map((t) => `- ${t.testCaseId ?? ""} ${t.title}`.trim()).join("\n") || run.errorMessage || "",
      link,
    });
    await postToTeams(resultsChannel.webhookUrl, text);
  }

  if (schedule.teamsBugReports && bugsChannel) {
    for (const test of failedTests) {
      const report = buildBugReport({
        testCaseId: test.testCaseId,
        title: test.title,
        module: test.module,
        feature: test.feature,
        role: test.role,
        failureType: test.failureType ?? "product",
        errorMessage: test.errorMessage,
        steps: test.steps,
        culprits: test.culprits,
        knownBug: test.knownBug,
      });
      const text = renderTemplate(settings?.bugTemplate || DEFAULT_TEMPLATES.bug, { ...report, schedule: scheduleText, link });
      await postToTeams(bugsChannel.webhookUrl, text);
    }
  }
}

/** Weekdays at 08:00: one message with the scheduled runs since the last summary. */
export async function sendMorningSummary(now: Date): Promise<void> {
  const { settings, byId } = await channels();
  if (!settings?.morningEnabled || !settings.morningChannelId) return;
  const channel = byId.get(settings.morningChannelId);
  if (!channel) return;
  const day = now.getDay();
  const due = new Date(now);
  due.setHours(8, 0, 0, 0);
  if (day === 0 || day === 6 || now < due) return;
  if (settings.morningLastSentAt && settings.morningLastSentAt >= due) return;

  const since = settings.morningLastSentAt ?? new Date(now.getTime() - 24 * 3_600_000);
  const runs = (
    await db
      .select()
      .from(schema.runs)
      .where(and(eq(schema.runs.trigger, "scheduled"), inArray(schema.runs.status, ["passed", "failed", "stopped", "error", "not_ready"])))
  ).filter((run) => run.finishedAt && run.finishedAt > since);
  const lines = runs.map(
    (run) => `- ${STATUS_WORDS[run.status]}: ${run.name}, ${run.passed + run.flaky}/${run.total} passed ${env.appUrl}/automation-test/runs/${run.id}`,
  );
  const text = [`Morning summary: ${runs.length} scheduled ${runs.length === 1 ? "run" : "runs"}`, "", lines.join("\n") || "No scheduled runs since the last summary."].join("\n");
  await postToTeams(channel.webhookUrl, text);
  await db.update(schema.teamsSettings).set({ morningLastSentAt: now }).where(eq(schema.teamsSettings.id, 1));
}
