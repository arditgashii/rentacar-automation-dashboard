"use client";

import { CalendarClock, Play, RotateCcw, Square } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import type { RunCard as RunCardData } from "@/lib/automation/runs-data";
import { api } from "@/lib/client/api";
import { formatDuration, formatTime } from "@/lib/format";
import { AddToSuite } from "./add-to-suite";
import { useAutomation } from "./context";
import { ProgressBar } from "./now-panel";
import { RunStatusBadge } from "./status";

function Count({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <span className="tabular text-sm">
      <span className={value ? className : "text-faint"}>{value}</span> <span className="text-muted">{label}</span>
    </span>
  );
}

export function RunCard({ run }: { run: RunCardData }) {
  const { bump } = useAutomation();
  const finished = !["queued", "running"].includes(run.status);

  async function rerun() {
    try {
      const queued = await api<{ runningNow: boolean; position: number }>(`/api/automation/runs/${run.id}/rerun`, { body: {} });
      toast.success(queued.runningNow ? `Added to the queue (position ${queued.position}).` : "The run starts in a moment.");
      bump();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function stop() {
    try {
      await api(`/api/automation/runs/${run.id}/stop`, { body: {} });
      toast.success(run.status === "queued" ? "Run cancelled." : "Stopping the run.");
      bump();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <article className="rounded-lg border border-line bg-surface px-4 py-3" data-testid="run-card">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-[1_1_260px]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/automation-test/runs/${run.id}`} className="truncate font-medium hover:underline" title={run.name}>
              {run.name}
            </Link>
            <RunStatusBadge status={run.status} />
            {run.trigger === "scheduled" ? (
              <Badge tone="neutral" title={run.scheduleName ?? undefined}>
                <CalendarClock className="size-3" aria-hidden /> Scheduled
              </Badge>
            ) : null}
            {run.testSet === "smoke" ? <Badge tone="neutral">Smoke</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted">
            <span className="font-mono">#{run.number}</span>
            {" · "}
            {formatTime(run.startedAt ?? run.queuedAt)}
            {run.durationMs !== null ? ` · ${formatDuration(run.durationMs)}` : ""}
            {run.startedBy ? ` · ${run.startedBy}` : run.trigger === "scheduled" && run.scheduleName ? ` · ${run.scheduleName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Count value={run.passed + run.flaky} label="passed" className="text-pass" />
          <Count value={run.failed} label="failed" className="text-fail" />
          <Count value={run.skipped} label="skipped" className="text-skip" />
          {run.knownBug ? <Count value={run.knownBug} label="known bug" className="text-known" /> : null}
        </div>
      </div>

      {run.status === "running" && run.progress ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <ProgressBar done={run.progress.done} total={run.progress.total} failed={run.progress.failed} />
          </div>
          <span className="tabular text-sm text-muted">
            {run.progress.done}/{run.progress.total}
          </span>
        </div>
      ) : null}
      {run.errorMessage && finished && run.total === 0 ? <p className="mt-2 text-sm text-fail">{run.errorMessage}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {finished ? (
          <Button size="sm" onClick={rerun}>
            <RotateCcw className="size-3.5" aria-hidden /> Rerun
          </Button>
        ) : (
          <Button size="sm" onClick={stop}>
            <Square className="size-3.5" aria-hidden /> {run.status === "queued" ? "Cancel" : "Stop"}
          </Button>
        )}
        <Link href={`/automation-test/runs/${run.id}`} className={buttonClass({ size: "sm" })}>
          View more
        </Link>
        {run.hasVideo ? (
          <Link href={`/automation-test/runs/${run.id}#media`} className={buttonClass({ size: "sm" })}>
            <Play className="size-3.5" aria-hidden /> Watch
          </Link>
        ) : null}
        {finished && run.source === "real" ? <AddToSuite runId={run.id} /> : null}
      </div>
    </article>
  );
}
