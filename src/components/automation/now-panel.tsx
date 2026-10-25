"use client";

import { ArrowUpToLine, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { api } from "@/lib/client/api";
import { formatUpcoming } from "@/lib/format";
import { useAutomation } from "./context";

function Section({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ProgressBar({ done, total, failed }: { done: number; total: number; failed: number }) {
  const width = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-hover"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label="Progress"
    >
      <div className={failed ? "h-full bg-fail transition-all" : "h-full bg-run transition-all"} style={{ width: `${width}%` }} />
    </div>
  );
}

export function NowPanel() {
  const { now, refreshNow } = useAutomation();

  async function act(promise: Promise<unknown>, done: string) {
    try {
      await promise;
      toast.success(done);
      refreshNow();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const running = now?.running;
  const progress = running?.progress;
  return (
    <aside aria-label="Now" className="xl:sticky xl:top-6 xl:self-start">
      <Card>
        <Section
          title="Running now"
          action={
            running ? (
              <Button size="sm" variant="secondary" onClick={() => act(api(`/api/automation/runs/${running.id}/stop`, { body: {} }), "Stopping the run.")}>
                Stop
              </Button>
            ) : null
          }
        >
          {!now ? (
            <div className="h-10 animate-pulse rounded-md bg-hover" />
          ) : running ? (
            <div className="flex flex-col gap-2" data-testid="now-running">
              <Link href={`/automation-test/runs/${running.id}`} className="truncate font-medium hover:underline" title={running.name}>
                {running.name}
              </Link>
              <ProgressBar done={progress?.done ?? 0} total={progress?.total ?? running.total} failed={progress?.failed ?? 0} />
              <p className="tabular text-sm text-muted">
                {progress?.done ?? 0} of {progress?.total ?? running.total} done
                {progress?.failed ? <span className="text-fail">, {progress.failed} failed</span> : null}
              </p>
              {running.currentTitle ? (
                <p className="truncate text-sm text-muted" title={running.currentTitle}>
                  Now: {running.currentTitle}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-base text-muted">Nothing is running.</p>
          )}
        </Section>

        <Section
          title={`Queue (${now?.queue.length ?? 0})`}
          action={
            now && now.queue.length > 1 ? (
              <Button size="sm" variant="ghost" onClick={() => act(api("/api/automation/queue", { method: "DELETE" }), "Queue emptied.")}>
                Cancel all
              </Button>
            ) : null
          }
        >
          {now?.queue.length ? (
            <ol className="flex flex-col gap-1">
              {now.queue.map((run, index) => (
                <li key={run.id} className="group flex items-center gap-2 rounded-md py-1">
                  <span className="tabular w-4 shrink-0 text-sm text-faint">{index + 1}</span>
                  <Link href={`/automation-test/runs/${run.id}`} className="min-w-0 flex-1 truncate text-base hover:underline" title={run.name}>
                    {run.name}
                  </Link>
                  {index > 0 ? (
                    <Tooltip content="Move to top">
                      <button
                        className="rounded p-1 text-muted hover:bg-hover hover:text-ink"
                        aria-label={`Move ${run.name} to the top`}
                        onClick={() => act(api(`/api/automation/queue/${run.id}`, { body: { action: "top" } }), "Moved to the top.")}
                      >
                        <ArrowUpToLine className="size-3.5" />
                      </button>
                    </Tooltip>
                  ) : null}
                  <Tooltip content="Cancel">
                    <button
                      className="rounded p-1 text-muted hover:bg-hover hover:text-fail"
                      aria-label={`Cancel ${run.name}`}
                      onClick={() => act(api(`/api/automation/queue/${run.id}`, { body: { action: "cancel" } }), "Run cancelled.")}
                    >
                      <X className="size-3.5" />
                    </button>
                  </Tooltip>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-base text-muted">The queue is empty.</p>
          )}
        </Section>

        <Section title="Next run">
          {now?.nextRun ? (
            <div className="flex flex-col gap-0.5">
              <p className="truncate font-medium" title={now.nextRun.name}>
                {now.nextRun.name}
              </p>
              <p className="text-sm text-muted">{formatUpcoming(now.nextRun.at)}</p>
              <Link href="/automation-test/schedules" className="mt-1 text-sm text-accent hover:underline">
                Schedules
              </Link>
            </div>
          ) : (
            <p className="text-base text-muted">No active schedule.</p>
          )}
        </Section>

        <Section title="Needs attention">
          {now?.attention.tests.length ? (
            <ul className="flex flex-col gap-1.5">
              {now.attention.tests.map((test) => (
                <li key={test.nodeid}>
                  <Link
                    href={`/automation-test/runs/${now.attention.runId}?tab=failed`}
                    className="block truncate text-base hover:underline"
                    title={test.title}
                  >
                    {test.testCaseId ? <span className="mr-1.5 font-mono text-sm text-fail">{test.testCaseId}</span> : null}
                    {test.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-muted">Nothing failed in the last run.</p>
          )}
        </Section>
      </Card>
    </aside>
  );
}
