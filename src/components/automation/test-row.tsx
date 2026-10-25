"use client";

import { ChevronRight, Copy, ExternalLink, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { buildBugReport } from "@/lib/automation/bug-report";
import { firstLine } from "@/lib/automation/failure";
import { renderTemplate } from "@/lib/automation/teams";
import { FAILURE_TYPE_LABELS, type CulpritCommit, type TestMedia, type TestOutcome, type TestStep } from "@/lib/automation/types";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { OutcomeBadge } from "./status";

export type RunTest = {
  id: number;
  nodeid: string;
  testCaseId: string | null;
  title: string;
  module: string;
  feature: string;
  role: string;
  file: string;
  markers: string[];
  outcome: TestOutcome;
  attempts: number;
  durationMs: number;
  errorType: string | null;
  errorMessage: string | null;
  failureType: "product" | "test" | "environment" | "known_bug" | null;
  knownBug: string | null;
  failingSince: string | null;
  culprits: CulpritCommit[] | null;
  steps: TestStep[] | null;
  media: TestMedia | null;
  isSetup: boolean;
};

export function mediaUrl(runId: string, path: string): string {
  return `/api/automation/runs/${runId}/files/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function TestRow({
  test,
  runId,
  runStartedAt,
  bugTemplate,
  mediaDeleted,
  onRerun,
}: {
  test: RunTest;
  runId: string;
  runStartedAt: string | null;
  bugTemplate: string;
  mediaDeleted: boolean;
  onRerun: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const failed = test.outcome === "failed" || test.outcome === "known_bug";
  const costly = test.markers.includes("costly");
  const since = test.failingSince && runStartedAt && new Date(test.failingSince) < new Date(runStartedAt) ? test.failingSince : null;

  async function rerun() {
    setConfirm(false);
    try {
      await api(`/api/automation/runs/${runId}/rerun`, { body: { nodeid: test.nodeid } });
      toast.success(`${test.testCaseId ?? "The test"} runs again in a moment.`);
      onRerun();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <li className="border-b border-line last:border-b-0" data-testid="test-row">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`${open ? "Hide" : "Show"} details of ${test.title}`}
        >
          <ChevronRight className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-90")} aria-hidden />
          <OutcomeBadge outcome={test.outcome} />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              {test.testCaseId ? <span className="shrink-0 font-mono text-sm text-muted">{test.testCaseId}</span> : null}
              <span className="truncate" title={test.title}>
                {test.title}
              </span>
            </span>
            {failed && test.errorMessage ? (
              <span className="mt-0.5 block truncate text-sm text-muted" title={test.errorMessage}>
                {firstLine(test.errorMessage, 160)}
              </span>
            ) : null}
          </span>
        </button>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {test.attempts > 1 ? <Badge tone="neutral">{test.attempts} attempts</Badge> : null}
          {test.outcome === "flaky" ? <Badge tone="flaky">Flaky</Badge> : null}
          {since ? <Badge tone="fail">Failing since {new Date(since).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</Badge> : null}
          <span className="tabular w-14 text-right text-sm text-muted">{formatDuration(test.durationMs)}</span>
        </div>
        <Tooltip content={costly ? "Run this test again (spends LLM credits)" : "Run this test again"}>
          <Button size="sm" icon aria-label={`Run ${test.title} again`} onClick={() => (costly ? setConfirm(true) : rerun())}>
            <RotateCcw className="size-3.5" />
          </Button>
        </Tooltip>
      </div>

      {open ? (
        <TestDetails test={test} runId={runId} bugTemplate={bugTemplate} mediaDeleted={mediaDeleted} since={since} />
      ) : null}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent
          title="Run a test that spends LLM credits?"
          size="sm"
          footer={
            <>
              <Button onClick={() => setConfirm(false)}>Cancel</Button>
              <Button variant="primary" onClick={rerun}>
                Run it
              </Button>
            </>
          }
        >
          <p className="text-base text-muted">
            {test.testCaseId} calls the LLM of the platform. With a real API key this costs money; with the mock it is free.
          </p>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function TestDetails({
  test,
  runId,
  bugTemplate,
  mediaDeleted,
  since,
}: {
  test: RunTest;
  runId: string;
  bugTemplate: string;
  mediaDeleted: boolean;
  since: string | null;
}) {
  const failed = test.outcome === "failed" || test.outcome === "known_bug";
  const report = failed
    ? buildBugReport({
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
      })
    : null;

  async function copyReport() {
    if (!report) return;
    const link = `${window.location.origin}/automation-test/runs/${runId}`;
    await navigator.clipboard.writeText(renderTemplate(bugTemplate, { ...report, schedule: "", link }));
    toast.success("Bug report copied.");
  }

  const media = test.media;
  const hasMedia = Boolean(media && (media.screenshots.length || media.video || media.trace));
  return (
    <div className="flex flex-col gap-4 border-t border-line bg-subtle px-4 py-4 sm:pl-11">
      <p className="text-sm text-muted">
        <span className="font-mono break-all">{test.file}</span> · {test.role.replace(/-/g, " ")} · {test.markers.join(", ")}
      </p>

      {test.steps?.length ? (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">Steps</h4>
          <ol className="flex flex-col gap-1">
            {test.steps.map((step, index) => (
              <li key={index} className={cn("flex gap-2 text-base", step.failed && "font-medium text-fail")}>
                <span className="tabular w-5 shrink-0 text-right text-muted">{index + 1}.</span>
                {step.title}
                {step.failed ? <span className="text-sm">(fails here)</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {failed && report ? (
        <div className="rounded-md border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold">Bug report</h4>
              <Badge tone={test.failureType === "known_bug" ? "known" : test.failureType === "product" ? "fail" : "flaky"}>
                {FAILURE_TYPE_LABELS[test.failureType ?? "product"]}
                {test.knownBug ? ` ${test.knownBug}` : ""}
              </Badge>
              <Badge tone="neutral">{since ? "Still failing" : "New failure"}</Badge>
            </div>
            <Button size="sm" onClick={copyReport}>
              <Copy className="size-3.5" aria-hidden /> Copy bug report
            </Button>
          </div>
          <dl className="grid gap-x-4 gap-y-2 px-3 py-3 text-base sm:grid-cols-[120px_1fr]">
            <dt className="text-muted">Title</dt>
            <dd>{report.title}</dd>
            <dt className="text-muted">Description</dt>
            <dd>{report.description}</dd>
            <dt className="text-muted">Expected</dt>
            <dd>{report.expected}</dd>
            <dt className="text-muted">Actual</dt>
            <dd className="text-fail">{report.actual}</dd>
            <dt className="text-muted">Commits</dt>
            <dd>
              {test.culprits?.length ? (
                <ul className="flex flex-col gap-1">
                  {test.culprits.map((commit) => (
                    <li key={commit.sha} className="flex min-w-0 items-baseline gap-2">
                      <a href={commit.url} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-sm text-accent hover:underline">
                        {commit.sha.slice(0, 7)}
                      </a>
                      <span className="truncate" title={commit.message}>
                        {commit.message}
                      </span>
                      <span className="shrink-0 text-sm text-muted">{commit.author}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted">No platform commits since the test last passed (or it never passed here).</span>
              )}
            </dd>
          </dl>
        </div>
      ) : null}

      {hasMedia ? (
        mediaDeleted ? (
          <p className="text-sm text-muted">The video and screenshots of this run were deleted after the retention period.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold">Media</h4>
            {media?.video ? (
              <video controls preload="metadata" className="w-full max-w-2xl rounded-md border border-line" src={mediaUrl(runId, media.video)} />
            ) : null}
            {media?.screenshots.length ? (
              <div className="flex flex-wrap gap-2">
                {media.screenshots.map((shot) => (
                  <a key={shot} href={mediaUrl(runId, shot)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with a session, not optimisable */}
                    <img src={mediaUrl(runId, shot)} alt="Screenshot at the failure" className="h-32 rounded-md border border-line object-cover" />
                  </a>
                ))}
              </div>
            ) : null}
            {media?.trace ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted">Open the trace in Playwright (run this in the QA repo after downloading it):</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-hover px-2 py-1 font-mono text-sm">playwright show-trace trace-{runId}.zip</code>
                  <a href={mediaUrl(runId, media.trace)} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                    Download trace <ExternalLink className="size-3" aria-hidden />
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        )
      ) : null}

      {!failed && !hasMedia && !test.steps?.length ? <p className="text-sm text-muted">No details were recorded for this test.</p> : null}
    </div>
  );
}
