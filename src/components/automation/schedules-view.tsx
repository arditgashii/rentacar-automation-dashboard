"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm";
import { Input, Select } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreButton } from "@/components/ui/menu";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { REPEAT_LABELS } from "@/lib/automation/schedule";
import type { Repeat, RunStatus, RunTarget } from "@/lib/automation/types";
import { api, useResource } from "@/lib/client/api";
import { formatUpcoming, plural } from "@/lib/format";
import { useAutomation } from "./context";
import { RunStatusBadge } from "./status";

type ScheduleRow = {
  id: string;
  name: string;
  target: RunTarget;
  testSet: "smoke" | "full";
  includeCostly: boolean;
  whatRuns: string;
  repeat: Repeat;
  days: number[];
  time: string;
  repeatText: string;
  paused: boolean;
  nextRunAt: string | null;
  missedAt: string | null;
  lastRun: { id: string; number: number; status: RunStatus; passed: number; flaky: number; total: number } | null;
  teamsChannelId: string | null;
  teamsMode: "every" | "failures";
  teamsBugReports: boolean;
  teams: string;
  testsGone: boolean;
};

type Sort = "name" | "next";

export function SchedulesView() {
  const { version, openNewRun, bump } = useAutomation();
  const list = useResource<{ schedules: ScheduleRow[] }>(`/api/automation/schedules?v=${version}`, 15_000);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("next");
  const [status, setStatus] = useState("");
  const [teams, setTeams] = useState("");
  const [repeat, setRepeat] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const confirm = useConfirm();

  const rows = useMemo(() => {
    const all = list.data?.schedules ?? [];
    const q = query.trim().toLowerCase();
    return all
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.whatRuns.toLowerCase().includes(q))
      .filter((s) => !status || (status === "paused" ? s.paused : status === "missed" ? Boolean(s.missedAt) : !s.paused))
      .filter((s) => !teams || (teams === "off" ? !s.teamsChannelId : Boolean(s.teamsChannelId)))
      .filter((s) => !repeat || s.repeat === repeat)
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : (a.nextRunAt ?? "9999").localeCompare(b.nextRunAt ?? "9999") || a.name.localeCompare(b.name),
      );
  }, [list.data, query, status, teams, repeat, sort]);

  async function act(promise: Promise<unknown>, message: string) {
    try {
      await promise;
      toast.success(message);
      bump();
      list.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const edit = (s: ScheduleRow) =>
    openNewRun({
      schedule: {
        id: s.id,
        name: s.name,
        target: s.target,
        testSet: s.testSet,
        includeCostly: s.includeCostly,
        repeat: s.repeat,
        days: s.days,
        time: s.time,
        teamsChannelId: s.teamsChannelId,
        teamsMode: s.teamsMode,
        teamsBugReports: s.teamsBugReports,
      },
    });
  const remove = (ids: string[], names: string) =>
    confirm.ask(
      ids.length === 1 ? "Delete this schedule?" : `Delete ${ids.length} schedules?`,
      <>{names} will stop running. Runs it already made stay in the history.</>,
      "Delete",
      () => act(ids.length === 1 ? api(`/api/automation/schedules/${ids[0]}`, { method: "DELETE" }) : api("/api/automation/schedules/bulk", { body: { ids, action: "delete" } }), ids.length === 1 ? "Schedule deleted." : `${ids.length} schedules deleted.`).then(() => setSelected([])),
    );

  function menu(s: ScheduleRow) {
    return (
      <DropdownMenu>
        <MoreButton label={`Actions for ${s.name}`} />
        <DropdownMenuContent>
          <DropdownMenuItem disabled={s.testsGone} onSelect={() => act(api(`/api/automation/schedules/${s.id}/run`, { body: {} }), "The run starts in a moment.")}>
            Run now
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => edit(s)}>Edit</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => act(api(`/api/automation/schedules/${s.id}`, { method: "PATCH", body: { paused: !s.paused } }), s.paused ? "Schedule resumed." : "Schedule paused.")}>
            {s.paused ? "Resume" : "Pause"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger onSelect={() => remove([s.id], s.name)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function badges(s: ScheduleRow) {
    return (
      <>
        {s.paused ? <Badge tone="neutral">Paused</Badge> : null}
        {s.missedAt ? <Badge tone="flaky" title={`Missed the run of ${formatUpcoming(s.missedAt)}`}>Missed</Badge> : null}
        {s.testsGone ? <Badge tone="fail">Tests no longer available</Badge> : null}
      </>
    );
  }

  const nextText = (s: ScheduleRow) => (s.paused || !s.nextRunAt ? "-" : formatUpcoming(s.nextRunAt));
  const lastResult = (s: ScheduleRow) =>
    s.lastRun ? (
      <Link href={`/automation-test/runs/${s.lastRun.id}`} className="inline-flex items-center gap-2 hover:underline">
        <RunStatusBadge status={s.lastRun.status} />
        <span className="tabular text-sm text-muted">
          {s.lastRun.passed + s.lastRun.flaky}/{s.lastRun.total}
        </span>
      </Link>
    ) : (
      <span className="text-sm text-muted">Not run yet</span>
    );
  const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
          <Input aria-label="Search schedules" className="pl-8" placeholder="Search schedules" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="next">Next run first</option>
          <option value="name">By name</option>
        </Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="missed">Missed</option>
        </Select>
        <Select aria-label="Teams" value={teams} onChange={(e) => setTeams(e.target.value)}>
          <option value="">Teams: any</option>
          <option value="on">Posts to Teams</option>
          <option value="off">Teams off</option>
        </Select>
        <Select aria-label="Repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
          <option value="">Any repeat</option>
          {Object.entries(REPEAT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {selected.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-3 py-2" role="region" aria-label="Bulk actions">
          <span className="mr-2 text-base font-medium">{selected.length} selected</span>
          <Button size="sm" onClick={() => act(api("/api/automation/schedules/bulk", { body: { ids: selected, action: "pause" } }), "Paused.")}>
            Pause
          </Button>
          <Button size="sm" onClick={() => act(api("/api/automation/schedules/bulk", { body: { ids: selected, action: "resume" } }), "Resumed.")}>
            Resume
          </Button>
          <Button size="sm" variant="danger" onClick={() => remove(selected, plural(selected.length, "schedule"))}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      ) : null}

      {list.loading && !list.data ? (
        <SkeletonRows rows={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data?.schedules.length ? (
        <EmptyState title="No schedules yet." action={<Button variant="primary" onClick={() => openNewRun({ mode: "schedule" })}>New schedule</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No schedules match these filters." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-line bg-surface md:block">
            <table className="w-full table-fixed text-base">
              <thead>
                <tr className="border-b border-line bg-subtle text-left text-sm text-muted">
                  <th className="w-10 px-3 py-2">
                    <Checkbox aria-label="Select all" checked={allChecked ? true : selected.length ? "indeterminate" : false} onCheckedChange={(on) => setSelected(on ? rows.map((r) => r.id) : [])} />
                  </th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">What runs</th>
                  <th className="w-[15%] px-3 py-2 font-medium">Repeat</th>
                  <th className="w-[14%] px-3 py-2 font-medium">Next run</th>
                  <th className="w-[14%] px-3 py-2 font-medium">Last result</th>
                  <th className="w-[12%] px-3 py-2 font-medium">Teams</th>
                  <th className="w-12 px-3 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-b-0 hover:bg-subtle" data-testid="schedule-row">
                    <td className="px-3 py-2.5">
                      <Checkbox aria-label={`Select ${s.name}`} checked={selected.includes(s.id)} onCheckedChange={(on) => setSelected(on ? [...selected, s.id] : selected.filter((id) => id !== s.id))} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium" title={s.name}>{s.name}</span>
                        {badges(s)}
                      </div>
                    </td>
                    <td className="truncate px-3 py-2.5 text-muted" title={s.whatRuns}>{s.whatRuns}</td>
                    <td className="px-3 py-2.5 break-words">{s.repeatText}</td>
                    <td className="px-3 py-2.5 break-words">{nextText(s)}</td>
                    <td className="px-3 py-2.5">{lastResult(s)}</td>
                    <td className={`px-3 py-2.5 break-words ${s.teams === "Channel deleted" ? "text-fail" : s.teams === "Off" ? "text-muted" : ""}`} title={s.teams}>{s.teams}</td>
                    <td className="px-3 py-2.5 text-right">{menu(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((s) => (
              <li key={s.id} className="rounded-lg border border-line bg-surface px-4 py-3" data-testid="schedule-row">
                <div className="flex items-start gap-3">
                  <Checkbox className="mt-0.5" aria-label={`Select ${s.name}`} checked={selected.includes(s.id)} onCheckedChange={(on) => setSelected(on ? [...selected, s.id] : selected.filter((id) => id !== s.id))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-medium">{s.name}</span>
                      {badges(s)}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">{s.whatRuns}</p>
                    <p className="text-sm">{s.repeatText}</p>
                    <p className="text-sm text-muted">Next: {nextText(s)} · Teams: {s.teams}</p>
                    <div className="mt-1.5">{lastResult(s)}</div>
                  </div>
                  {menu(s)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {confirm.dialog}
    </div>
  );
}
