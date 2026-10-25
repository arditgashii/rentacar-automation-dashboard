"use client";

import { AlertTriangle, Copy, RotateCcw, Square, Terminal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, MoreButton } from "@/components/ui/menu";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { label } from "@/lib/automation/catalog";
import type { RunCard } from "@/lib/automation/runs-data";
import type { CulpritCommit, EnvironmentReport, RunOptions } from "@/lib/automation/types";
import { api, useResource } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDuration, plural } from "@/lib/format";
import { AddToSuiteSubmenu } from "./add-to-suite";
import { useAutomation } from "./context";
import { AutomationHeader } from "./header";
import { ProgressBar } from "./now-panel";
import { RunStatusBadge } from "./status";
import { mediaUrl, type RunTest, TestRow } from "./test-row";

type Details = {
  run: RunCard;
  options: RunOptions;
  command: string;
  platformCommit: string | null;
  platformCommitUrl: string | null;
  environmentReport: EnvironmentReport | null;
  mediaDeleted: boolean;
  mediaRetentionDays: number;
  rerunOf: string | null;
  tests: RunTest[];
  apiChanges: CulpritCommit[];
  notInRun: { nodeid: string; title: string; testCaseId: string | null }[];
  bugTemplate: string;
};

const TABS = [
  { key: "all", label: "All" },
  { key: "failed", label: "Failed" },
  { key: "known", label: "Known bugs" },
  { key: "passed", label: "Passed" },
  { key: "skipped", label: "Skipped" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function inTab(test: RunTest, tab: Tab): boolean {
  if (tab === "failed") return test.outcome === "failed";
  if (tab === "known") return test.outcome === "known_bug";
  if (tab === "passed") return test.outcome === "passed" || test.outcome === "flaky";
  if (tab === "skipped") return test.outcome === "skipped";
  return true;
}

export function RunDetails({ runId }: { runId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { bump } = useAutomation();
  const [live, setLive] = useState(true);
  const details = useResource<Details>(`/api/automation/runs/${runId}`, live ? 2500 : undefined);
  const [log, setLog] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const tab = (params.get("tab") as Tab | null) ?? "all";
  const data = details.data;
  const active = data ? ["queued", "running"].includes(data.run.status) : true;
  const wasActive = useRef(active);

  // Stop polling when the run ends, and say so once.
  useEffect(() => {
    if (!data) return;
    if (wasActive.current && !active) toast.success(`Run #${data.run.number} finished: ${data.run.status.replace("_", " ")}.`);
    wasActive.current = active;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling stops once the run is final
    if (!active) setLive(false);
  }, [active, data]);

  const groups = useMemo(() => {
    const tests = (data?.tests ?? []).filter((test) => inTab(test, tab));
    const map = new Map<string, RunTest[]>();
    for (const test of tests) {
      const key = test.isSetup ? "Setup" : `${label(test.module)} / ${label(test.feature)}`;
      map.set(key, [...(map.get(key) ?? []), test]);
    }
    return [...map].sort(([a], [b]) => (a === "Setup" ? -1 : b === "Setup" ? 1 : a.localeCompare(b)));
  }, [data, tab]);

  function setTab(next: Tab) {
    const query = new URLSearchParams(params.toString());
    if (next === "all") query.delete("tab");
    else query.set("tab", next);
    router.replace(`${pathname}${query.size ? `?${query}` : ""}`, { scroll: false });
  }

  async function rerun() {
    try {
      const run = await api<{ id: string }>(`/api/automation/runs/${runId}/rerun`, { body: {} });
      bump();
      router.push(`/automation-test/runs/${run.id}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function stop() {
    try {
      await api(`/api/automation/runs/${runId}/stop`, { body: {} });
      toast.success("Stopping the run.");
      details.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function showLog() {
    try {
      const result = await api<{ log: string | null; truncated?: boolean }>(`/api/automation/runs/${runId}/log`);
      setLog(result.log === null ? "No terminal output was saved for this run." : (result.truncated ? "(showing the last 2 MB)\n" : "") + result.log);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const crumbs = [{ label: "Runs", href: "/automation-test/runs" }, { label: "Run details" }];
  if (details.error) {
    const notFound = details.error === "Run not found.";
    return (
      <>
        <AutomationHeader tab={null} title="Run details" crumbs={crumbs} />
        {notFound ? (
          <EmptyState title="This run does not exist. It may have been removed." action={<Link href="/automation-test/runs" className={buttonClass()}>All runs</Link>} />
        ) : (
          <ErrorState message={details.error} onRetry={details.reload} />
        )}
      </>
    );
  }
  if (!data) {
    return (
      <>
        <AutomationHeader tab={null} title="Run details" crumbs={crumbs} />
        <SkeletonRows rows={6} />
      </>
    );
  }

  const run = data.run;
  const counts = {
    passed: run.passed + run.flaky,
    failed: run.failed,
    flaky: run.flaky,
    skipped: run.skipped,
    known: run.knownBug,
  };
  const video = data.tests.find((test) => test.media?.video);
  const env = data.environmentReport;
  const roles = [...new Set(data.tests.map((t) => t.role.replace(/-/g, " ")))];

  return (
    <>
      <AutomationHeader
        tab={null}
        crumbs={crumbs}
        title={
          <span className="flex min-w-0 items-center gap-3">
            <span className="truncate" title={run.name}>
              {run.name}
            </span>
            <RunStatusBadge status={run.status} />
          </span>
        }
        actions={
          <>
            {active ? (
              <Button onClick={stop}>
                <Square className="size-3.5" aria-hidden /> {run.status === "queued" ? "Cancel" : "Stop"}
              </Button>
            ) : (
              <Button onClick={rerun}>
                <RotateCcw className="size-3.5" aria-hidden /> Rerun
              </Button>
            )}
            <DropdownMenu>
              <MoreButton label="More run actions" />
              <DropdownMenuContent>
                {!active && run.source === "real" ? <AddToSuiteSubmenu runId={run.id} /> : null}
                <DropdownMenuItem disabled={!video || data.mediaDeleted} onSelect={() => document.getElementById("media")?.scrollIntoView({ behavior: "smooth" })}>
                  Watch recording
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setChangesOpen(true)}>API changes</DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    await navigator.clipboard.writeText(run.id);
                    toast.success("Run ID copied.");
                  }}
                >
                  Copy run ID
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="-mt-2 mb-5 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted">
        <span className="font-mono">#{run.number}</span>
        <span aria-hidden>·</span>
        <span>{run.trigger === "scheduled" ? `Scheduled${run.scheduleName ? `: ${run.scheduleName}` : ""}` : `On demand${run.startedBy ? ` by ${run.startedBy}` : ""}`}</span>
        <span aria-hidden>·</span>
        <span>Local</span>
        {roles.length ? (
          <>
            <span aria-hidden>·</span>
            <span>{roles.join(", ")}</span>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <span>{formatDateTime(run.startedAt ?? run.queuedAt)}</span>
        {run.durationMs !== null ? (
          <>
            <span aria-hidden>·</span>
            <span>{formatDuration(run.durationMs)}</span>
          </>
        ) : null}
        {data.rerunOf ? (
          <>
            <span aria-hidden>·</span>
            <Link href={`/automation-test/runs/${data.rerunOf}`} className="text-accent hover:underline">
              Rerun of an earlier run
            </Link>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        {data.command ? (
          <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
            <Terminal className="size-4 shrink-0 text-faint" aria-hidden />
            <code className="min-w-0 flex-1 truncate font-mono text-sm" title={data.command}>
              {data.command}
            </code>
            <Button
              size="sm"
              icon
              aria-label="Copy command"
              onClick={async () => {
                await navigator.clipboard.writeText(data.command);
                toast.success("Command copied.");
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        ) : null}

        {run.status === "running" && run.progress ? (
          <Card className="px-4 py-3" aria-live="polite">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Running</span>
              <span className="tabular text-muted">
                {run.progress.done} of {run.progress.total}
              </span>
            </div>
            <ProgressBar done={run.progress.done} total={run.progress.total} failed={run.progress.failed} />
          </Card>
        ) : null}

        {run.errorMessage ? (
          <p role="alert" className="rounded-md border border-fail/25 bg-fail-soft px-3 py-2 text-base text-fail">
            {run.errorMessage}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Passed" value={counts.passed} tone="text-pass" onClick={() => setTab("passed")} active={tab === "passed"} />
          <StatCard label="Failed" value={counts.failed} tone="text-fail" onClick={() => setTab("failed")} active={tab === "failed"} />
          <StatCard label="Flaky" value={counts.flaky} tone="text-flaky" onClick={() => setTab("passed")} active={false} />
          <StatCard label="Skipped" value={counts.skipped} tone="text-skip" onClick={() => setTab("skipped")} active={tab === "skipped"} />
          {counts.known ? <StatCard label="Known bug" value={counts.known} tone="text-known" onClick={() => setTab("known")} active={tab === "known"} /> : null}
        </div>

        <Card>
          <div className="flex flex-wrap gap-1 border-b border-line px-2 pt-1">
            {TABS.map((item) => {
              const count = data.tests.filter((test) => inTab(test, item.key)).length;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  aria-current={tab === item.key ? "page" : undefined}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-base font-medium",
                    tab === item.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {item.label}
                  <span className="tabular text-xs text-faint">{count}</span>
                </button>
              );
            })}
          </div>
          {groups.length === 0 ? (
            <p className="px-4 py-6 text-base text-muted">
              {active && data.tests.length === 0 ? "Results appear when the run ends." : "No tests in this tab."}
            </p>
          ) : (
            groups.map(([group, tests]) => (
              <section key={group}>
                <h3 className="border-b border-line bg-subtle px-4 py-1.5 text-sm font-semibold text-muted">
                  {group} <span className="font-normal text-faint">{tests.length}</span>
                </h3>
                <ul>
                  {tests.map((test) => (
                    <TestRow
                      key={test.id}
                      test={test}
                      runId={run.id}
                      runStartedAt={run.startedAt}
                      bugTemplate={data.bugTemplate}
                      mediaDeleted={data.mediaDeleted}
                      onRerun={bump}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </Card>

        {data.notInRun.length ? (
          <Card>
            <CardHeader title="Compared with the suite" description={`${plural(data.notInRun.length, "test")} of the suite did not run.`} />
            <ul className="px-4 py-2">
              {data.notInRun.map((test) => (
                <li key={test.nodeid} className="truncate py-1 text-base" title={test.title}>
                  {test.testCaseId ? <span className="mr-2 font-mono text-sm text-muted">{test.testCaseId}</span> : null}
                  {test.title}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {env ? <EnvironmentCard report={env} commit={data.platformCommit} commitUrl={data.platformCommitUrl} /> : null}

        <section id="media" className="scroll-mt-6">
          <Card>
            <CardHeader title="Media" description="Video, screenshots and traces are kept for tests that failed." />
            <div className="px-4 py-3">
              {data.mediaDeleted ? (
                <p className="text-base text-muted">The media of this run was deleted after {data.mediaRetentionDays} days. The results above stay.</p>
              ) : video?.media?.video ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted">
                    {video.testCaseId} {video.title}
                  </p>
                  <video controls preload="metadata" className="w-full max-w-3xl rounded-md border border-line" src={mediaUrl(run.id, video.media.video)} />
                  <p className="text-sm text-muted">Open a failed test above for its screenshots and trace.</p>
                </div>
              ) : (
                <p className="text-base text-muted">No media: every UI test passed, or the run had no UI tests.</p>
              )}
            </div>
          </Card>
        </section>

        <Card>
          <CardHeader
            title="Terminal output"
            actions={
              log === null ? (
                <Button size="sm" onClick={showLog}>
                  Show terminal output
                </Button>
              ) : (
                <Button size="sm" onClick={() => setLog(null)}>
                  Hide
                </Button>
              )
            }
          />
          {log !== null ? (
            <pre className="max-h-[480px] overflow-auto px-4 py-3 font-mono text-xs leading-5 whitespace-pre-wrap text-ink">{log}</pre>
          ) : null}
        </Card>
      </div>

      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent title="API changes" description="Platform commits since the previous finished run.">
          {data.apiChanges.length ? (
            <ul className="flex flex-col gap-2">
              {data.apiChanges.map((commit) => (
                <li key={commit.sha} className="flex min-w-0 items-baseline gap-2">
                  <a href={commit.url} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-sm text-accent hover:underline">
                    {commit.sha.slice(0, 7)}
                  </a>
                  <span className="min-w-0 truncate" title={commit.message}>
                    {commit.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-muted">No platform commits between the previous run and this one.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatCard({ label: text, value, tone, onClick, active }: { label: string; value: number; tone: string; onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start rounded-lg border bg-surface px-4 py-3 text-left hover:border-line-strong",
        active ? "border-ink" : "border-line",
      )}
    >
      <span className="text-sm text-muted">{text}</span>
      <span className={cn("tabular text-2xl font-semibold", value ? tone : "text-faint")}>{value}</span>
    </button>
  );
}

function EnvironmentCard({ report, commit, commitUrl }: { report: EnvironmentReport; commit: string | null; commitUrl: string | null }) {
  return (
    <Card>
      <CardHeader title="Environment" description={`Checked before the run at ${formatDateTime(report.checkedAt)}.`} />
      <div className="flex flex-col gap-3 px-4 py-3">
        {report.warnings.map((warning) => (
          <p key={warning} className="flex items-start gap-2 rounded-md bg-flaky-soft px-3 py-2 text-base text-flaky">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {warning}
          </p>
        ))}
        <dl className="grid gap-x-4 gap-y-1.5 text-base sm:grid-cols-[160px_1fr]">
          <dt className="text-muted">Platform</dt>
          <dd>
            {report.platformUrl} {report.reachable ? <span className="text-pass">answers</span> : <span className="text-fail">does not answer</span>}
          </dd>
          <dt className="text-muted">Dependencies</dt>
          <dd>
            {Object.entries(report.checks).length
              ? Object.entries(report.checks).map(([name, value]) => (
                  <span key={name} className={cn("mr-3", value === "ok" ? "text-pass" : "text-fail")}>
                    {name}: {value}
                  </span>
                ))
              : "Not checked"}
          </dd>
          <dt className="text-muted">Version</dt>
          <dd>
            {report.version ?? "unknown"}
            {commit ? (
              <>
                {" · "}
                {commitUrl ? (
                  <a href={commitUrl} target="_blank" rel="noreferrer" className="font-mono text-sm text-accent hover:underline">
                    {commit.slice(0, 7)}
                  </a>
                ) : (
                  <span className="font-mono text-sm">{commit.slice(0, 7)}</span>
                )}
              </>
            ) : null}
          </dd>
          {report.seedAgeDays !== undefined ? (
            <>
              <dt className="text-muted">Seed data</dt>
              <dd>{plural(report.seedAgeDays, "day")} old</dd>
            </>
          ) : null}
          <dt className="text-muted">Accounts</dt>
          <dd className="flex min-w-0 flex-col">
            {report.accounts.map((line) => (
              <span key={line} className="truncate" title={line}>
                {line}
              </span>
            ))}
          </dd>
        </dl>
      </div>
    </Card>
  );
}

