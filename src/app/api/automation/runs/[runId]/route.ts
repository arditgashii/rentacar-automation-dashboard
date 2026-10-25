import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { commitsBetween } from "@/lib/automation/git";
import { resolveTarget } from "@/lib/automation/resolve";
import { cardsFor } from "@/lib/automation/runs-data";
import { DEFAULT_TEMPLATES } from "@/lib/automation/teams";
import { appId } from "@/lib/automation/validation";
import { errorResponse, json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

export const GET = route(async (_request: Request, context: { params: Promise<{ runId: string }> }) => {
  await requireApi("automation");
  const parsed = appId("run").safeParse((await context.params).runId);
  if (!parsed.success) return errorResponse(404, "Run not found.");
  const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, parsed.data) });
  if (!run) return errorResponse(404, "Run not found.");

  const [card] = await cardsFor(db, [run]);
  const tests = await db.select().from(schema.runTests).where(eq(schema.runTests.runId, run.id)).orderBy(schema.runTests.id);

  // Platform commits since the previous finished run ("API changes").
  const previous = await db.query.runs.findFirst({
    where: and(inArray(schema.runs.status, ["passed", "failed"]), lt(schema.runs.queuedAt, run.queuedAt)),
    orderBy: desc(schema.runs.queuedAt),
  });
  const apiChanges =
    run.platformCommit && previous?.platformCommit ? await commitsBetween(previous.platformCommit, run.platformCommit) : [];

  // A suite run lists the tests of the suite that did not run (deleted, filtered out by the test set, or stopped).
  let notInRun: { nodeid: string; title: string; testCaseId: string | null }[] = [];
  if (run.options.target.kind === "suite" && run.status !== "queued" && run.status !== "running") {
    const resolved = await resolveTarget(db, run.options.target, { testSet: "full", includeCostly: true });
    const ran = new Set(tests.map((t) => t.nodeid));
    notInRun = (resolved?.tests ?? []).filter((t) => !ran.has(t.nodeid)).map((t) => ({ nodeid: t.nodeid, title: t.title, testCaseId: t.testCaseId }));
  }

  const settings = await db.query.teamsSettings.findFirst();
  return json({
    run: card,
    options: run.options,
    command: run.command,
    platformCommit: run.platformCommit,
    platformCommitUrl: run.platformCommit ? `${env.platformGithubUrl}/commit/${run.platformCommit}` : null,
    environmentReport: run.environmentReport,
    mediaDeleted: run.mediaDeleted,
    mediaRetentionDays: env.mediaRetentionDays,
    rerunOf: run.rerunOf,
    tests,
    apiChanges,
    notInRun,
    bugTemplate: settings?.bugTemplate || DEFAULT_TEMPLATES.bug,
  });
});
