"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { PageHeader, PillTabs } from "@/components/ui/page";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { api, useResource } from "@/lib/client/api";
import { formatDay } from "@/lib/format";
import { ENVIRONMENTS, KINDS, type RegressionKind, TEAMS } from "@/lib/regression/library";
import type { Counts } from "@/lib/regression/model";
import { ReleasePicker } from "./release-picker";
import { ProgressBar, RunView } from "./run-view";

type RunSummary = { id: string; name: string; status: "open" | "completed"; startedAt: string; completedAt: string | null; counts: Counts };

export function RegressionView({ kind, canWrite }: { kind: RegressionKind; canWrite: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const team = (TEAMS as readonly string[]).includes(params.get("team") ?? "") ? params.get("team")! : TEAMS[0];
  const environment = (ENVIRONMENTS as readonly string[]).includes(params.get("env") ?? "") ? params.get("env")! : ENVIRONMENTS[0];
  const release = params.get("release")?.trim() ?? "";
  const sprint = kind === "sprint";
  const meta = KINDS.find((k) => k.key === kind)!;

  const listUrl = `/api/regression/runs?${new URLSearchParams({ kind, team, environment })}`;
  const list = useResource<{ runs: RunSummary[] }>(listUrl);
  const match = release ? list.data?.runs.find((r) => r.name.toLowerCase() === release.toLowerCase()) : undefined;

  const go = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      window.history.pushState(null, "", `${pathname}?${next}`);
    },
    [pathname],
  );

  async function add(name: string) {
    try {
      const run = await api<{ id: string; name: string; created: boolean }>("/api/regression/runs", { body: { kind, team, environment, name } });
      toast.success(run.created ? `${run.name} created${sprint ? "." : " with the team's library."}` : `${run.name} already exists; it is open now.`);
      list.refresh();
      go({ release: run.name });
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
  }

  // The tabs keep the team, so switching kinds stays with the same team.
  const tabs = KINDS.map((k) => ({ key: k.key, label: k.label, href: `/regression/${k.key}?${new URLSearchParams({ team, env: environment })}` }));

  return (
    <>
      <PageHeader crumbs={[{ label: "Dashboard", href: "/" }, { label: "Manual Regression", href: "/regression" }, { label: meta.label }]} title="Manual Regression">
        <PillTabs tabs={tabs} active={kind} />
        <p className="text-sm text-muted">{meta.description}</p>
      </PageHeader>

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]" data-testid="selection-bar">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="reg-team" className="text-xs font-medium text-muted">
            Team
          </label>
          <Select id="reg-team" value={team} onChange={(e) => go({ team: e.target.value, release: null })}>
            {TEAMS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="reg-env" className="text-xs font-medium text-muted">
            Environment
          </label>
          <Select id="reg-env" value={environment} onChange={(e) => go({ env: e.target.value, release: null })}>
            {ENVIRONMENTS.map((env) => (
              <option key={env}>{env}</option>
            ))}
          </Select>
        </div>
        <ReleasePicker
          key={`${kind}-${team}-${environment}`}
          label={sprint ? "Sprint" : "Release"}
          value={match?.name ?? release}
          listUrl={listUrl}
          canWrite={canWrite}
          onPick={(name) => go({ release: name })}
          onAdd={add}
        />
      </div>

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <SkeletonRows rows={6} />
      ) : match ? (
        <RunView key={match.id} runId={match.id} sprint={sprint} onChanged={list.refresh} runs={list.data.runs} onOpenRun={(name) => go({ release: name })} />
      ) : release ? (
        <EmptyState
          title={`There is no ${sprint ? "sprint" : "release"} named "${release}" for ${team} yet.`}
          action={canWrite ? <Button variant="primary" onClick={() => add(release).catch(() => undefined)}>{`Add "${release}"`}</Button> : undefined}
        />
      ) : list.data.runs.length ? (
        <RecentRuns runs={list.data.runs} sprint={sprint} team={team} kind={kind} environment={environment} />
      ) : (
        <EmptyState title={canWrite ? `No ${sprint ? "sprints" : "releases"} for ${team} yet. Type a name in the ${sprint ? "Sprint" : "Release"} field to start one.` : `No ${sprint ? "sprints" : "releases"} for ${team} yet.`} />
      )}
    </>
  );
}

function RecentRuns({ runs, sprint, team, kind, environment }: { runs: RunSummary[]; sprint: boolean; team: string; kind: string; environment: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-ink">
        {sprint ? "Sprints" : "Releases"} of {team}
      </h2>
      <ul className="overflow-hidden rounded-lg border border-line bg-surface">
        {runs.map((run) => {
          const tested = run.counts.total - run.counts.not_tested;
          return (
            <li key={run.id} className="border-b border-line last:border-b-0">
              <Link
                href={`/regression/${kind}?${new URLSearchParams({ team, env: environment, release: run.name })}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-subtle"
                data-testid="recent-run"
              >
                <span className="min-w-0 flex-[1_1_160px] truncate font-medium">{run.name}</span>
                {run.status === "completed" ? <Badge tone="neutral">Completed</Badge> : <Badge tone="run">In progress</Badge>}
                <span className="w-40">
                  <ProgressBar counts={run.counts} />
                </span>
                <span className="tabular w-28 text-sm text-muted">
                  {tested} of {run.counts.total} tested
                </span>
                <span className="tabular text-sm text-faint">{formatDay(run.startedAt)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
