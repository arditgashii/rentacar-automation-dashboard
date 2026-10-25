"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { Tooltip } from "@/components/ui/tooltip";
import type { Overview } from "@/lib/automation/overview";
import { FAILURE_TYPE_LABELS } from "@/lib/automation/types";
import { useResource } from "@/lib/client/api";
import { formatDay, formatUpcoming, plural } from "@/lib/format";
import { useAutomation } from "./context";
import { Segmented } from "./new-run-dialog";
import { ProgressBar } from "./now-panel";

type OverviewData = Overview & { nextRuns: { id: string; name: string; at: string }[] };

const INK = "#1b1b19";
const MUTED = "#6b6963";
const GRID = "#efede8";
const SERIES = "#0f5f56";

function StatCard({ label, value, info, sub }: { label: string; value: string; info: string; sub?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1 px-4 py-3">
      <span className="flex items-center gap-1.5 text-sm text-muted">
        {label}
        <Tooltip content={info}>
          <button aria-label={`About ${label}`} className="rounded text-faint hover:text-ink">
            <Info className="size-3.5" />
          </button>
        </Tooltip>
      </span>
      <span className="tabular text-2xl font-semibold">{value}</span>
      {sub ? <span className="text-sm text-muted">{sub}</span> : null}
    </Card>
  );
}

export function OverviewView() {
  const { now, openNewRun } = useAutomation();
  const [days, setDays] = useState<"7" | "30">("7");
  const overview = useResource<OverviewData>(`/api/automation/overview?days=${days}`, 15_000);
  const [chosenModules, setChosenModules] = useState<string[] | null>(null);
  const data = overview.data;

  const moduleRows = useMemo(() => {
    if (!data) return [];
    const chosen = chosenModules ?? data.modules.slice(0, 5).map((m) => m.module);
    return data.modules.filter((m) => chosen.includes(m.module) && m.rate !== null);
  }, [data, chosenModules]);

  if (overview.error) return <ErrorState message={overview.error} onRetry={overview.reload} />;
  if (!data) return <SkeletonRows rows={6} className="[&>div]:h-28" />;
  if (data.runs === 0 && !now?.running && !now?.queue.length) {
    return (
      <div className="flex flex-col gap-4">
        <PeriodSwitch days={days} setDays={setDays} />
        <EmptyState title={`No finished runs in the last ${days} days.`} action={<Button variant="primary" onClick={() => openNewRun()}>New run</Button>} />
      </div>
    );
  }

  const change = data.passRateChange;
  return (
    <div className="flex flex-col gap-5">
      <PeriodSwitch days={days} setDays={setDays} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Pass rate"
          value={data.passRate === null ? "-" : `${data.passRate}%`}
          info="Tests that passed (a pass on a retry counts) out of the tests that ran, skipped tests left out."
          sub={
            change === null ? "No earlier period to compare" : (
              <span className={change > 0 ? "text-pass" : change < 0 ? "text-fail" : undefined}>
                {change > 0 ? "+" : ""}
                {change} points vs the previous {days} days
              </span>
            )
          }
        />
        <StatCard label="Runs" value={String(data.runs)} info="Runs that finished in the period (stopped and not-ready runs are left out)." />
        <StatCard label="Failing now" value={String(data.failingNow)} info="Tests whose latest result is a failure, known bugs included." />
        <StatCard label="Flaky (30 days)" value={String(data.flakyCount)} info="Tests that passed on a retry, or both passed and failed in the last 30 days." />
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
        <Card>
          <CardHeader title="Pass rate per day" description="Days without runs are left empty." />
          <div className="h-56 px-2 py-3" role="img" aria-label={`Pass rate per day over the last ${days} days`}>
            <ResponsiveContainer>
              <LineChart data={data.daily} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => formatDay(`${value}T12:00:00`).replace(/^\w+ /, "")}
                  tick={{ fill: MUTED, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} />
                <ChartTooltip
                  cursor={{ stroke: MUTED, strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as OverviewData["daily"][number] | undefined;
                    if (!active || !point) return null;
                    return (
                      <div className="rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-pop)]">
                        <p className="font-medium text-ink">{formatDay(`${point.date}T12:00:00`)}</p>
                        <p className="text-muted">{point.rate === null ? "No runs" : `${point.rate}% passed, ${plural(point.runs, "run")}`}</p>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="rate" stroke={SERIES} strokeWidth={2} dot={{ r: 3, fill: SERIES, strokeWidth: 0 }} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Pass rate per module"
            description="The weakest modules first."
            actions={
              <div className="w-48">
                <MultiSelect
                  options={data.modules.map((m) => ({ value: m.module, label: m.label }))}
                  value={chosenModules ?? data.modules.slice(0, 5).map((m) => m.module)}
                  onChange={setChosenModules}
                  emptyLabel="No modules"
                />
              </div>
            }
          />
          <div className="px-2 py-3" style={{ height: Math.max(120, moduleRows.length * 40 + 24) }}>
            {moduleRows.length === 0 ? (
              <p className="px-2 py-6 text-base text-muted" role="alert">Choose at least one module.</p>
            ) : (
              <ResponsiveContainer>
                <BarChart data={moduleRows} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 8 }} barSize={20}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="label" width={120} tick={{ fill: INK, fontSize: 13 }} axisLine={false} tickLine={false} />
                  <ChartTooltip
                    cursor={{ fill: "#f2f1ee" }}
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as OverviewData["modules"][number] | undefined;
                      if (!active || !row) return null;
                      return (
                        <div className="rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-pop)]">
                          <p className="font-medium text-ink">{row.label}</p>
                          <p className="text-muted">
                            {row.passed} of {row.checked} results passed
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="rate" fill={SERIES} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    <LabelList dataKey="rate" position="right" formatter={(v: unknown) => `${v}%`} fill={INK} fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Needs attention" description="Tests failing now, oldest failure first." />
        {data.attention.length === 0 ? (
          <p className="px-4 py-4 text-base text-muted">Nothing is failing. Every test passed on its latest run.</p>
        ) : (
          <ul>
            {data.attention.map((test) => (
              <li key={test.nodeid} className="border-b border-line last:border-b-0">
                <Link href={`/automation-test/runs/${test.runId}?tab=${test.failureType === "known_bug" ? "known" : "failed"}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-subtle">
                  <span className="min-w-0 flex-[1_1_240px] truncate" title={test.title}>
                    {test.testCaseId ? <span className="mr-2 font-mono text-sm text-muted">{test.testCaseId}</span> : null}
                    {test.title}
                  </span>
                  <Badge tone={test.failureType === "known_bug" ? "known" : test.failureType === "product" ? "fail" : "flaky"}>
                    {FAILURE_TYPE_LABELS[test.failureType ?? "product"]}
                  </Badge>
                  <span className="text-sm text-muted">since {formatDay(test.since)}</span>
                  {test.culprits.length ? (
                    <span className="text-sm text-muted">{plural(test.culprits.length, "possible commit")}</span>
                  ) : null}
                  <span className="font-mono text-sm text-faint">#{test.runNumber}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Running now and queue" />
          <div className="flex flex-col gap-2 px-4 py-3">
            {now?.running ? (
              <Link href={`/automation-test/runs/${now.running.id}`} className="flex flex-col gap-1.5 rounded-md hover:bg-subtle">
                <span className="truncate font-medium">{now.running.name}</span>
                <ProgressBar done={now.running.progress?.done ?? 0} total={now.running.progress?.total ?? now.running.total} failed={now.running.progress?.failed ?? 0} />
              </Link>
            ) : (
              <p className="text-base text-muted">Nothing is running.</p>
            )}
            {now?.queue.length ? <p className="text-sm text-muted">{plural(now.queue.length, "run")} waiting: {now.queue.map((r) => r.name).join(", ")}</p> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Next runs" description="Today and this week; paused schedules are left out." />
          {data.nextRuns.length ? (
            <ul>
              {data.nextRuns.slice(0, 6).map((run) => (
                <li key={run.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-b-0">
                  <span className="truncate" title={run.name}>{run.name}</span>
                  <span className="shrink-0 text-sm text-muted">{formatUpcoming(run.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-base text-muted">No schedule runs this week.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Module health" description="From the weakest to the best." />
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-line text-left text-sm text-muted">
                <th className="px-4 py-2 font-medium">Module</th>
                <th className="px-4 py-2 text-right font-medium">Pass rate</th>
                <th className="px-4 py-2 text-right font-medium">Results</th>
              </tr>
            </thead>
            <tbody>
              {data.modules.map((m) => (
                <tr key={m.module} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2">{m.label}</td>
                  <td className={`px-4 py-2 text-right ${m.rate !== null && m.rate < 90 ? "text-fail" : ""}`}>{m.rate === null ? "-" : `${m.rate}%`}</td>
                  <td className="px-4 py-2 text-right text-muted">{m.checked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Flaky tests" description="Last 30 days." />
          {data.flaky.length ? (
            <ul>
              {data.flaky.slice(0, 8).map((test) => (
                <li key={test.nodeid} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-b-0">
                  <span className="min-w-0 truncate" title={test.title}>
                    {test.testCaseId ? <span className="mr-2 font-mono text-sm text-muted">{test.testCaseId}</span> : null}
                    {test.title}
                  </span>
                  <span className="shrink-0 text-sm text-flaky">
                    {test.notClean} of {test.runs} runs not clean
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-base text-muted">No flaky tests in the last 30 days.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function PeriodSwitch({ days, setDays }: { days: "7" | "30"; setDays: (value: "7" | "30") => void }) {
  return (
    <Segmented
      label="Period"
      value={days}
      onChange={(value) => setDays(value as "7" | "30")}
      options={[
        { value: "7", label: "7 days" },
        { value: "30", label: "30 days" },
      ]}
    />
  );
}
