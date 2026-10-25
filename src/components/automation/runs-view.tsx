"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { PERIOD_LABELS, type PeriodKey, validateCustom } from "@/lib/automation/period";
import type { RunCard as RunCardData } from "@/lib/automation/runs-data";
import { useResource } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatDay, plural } from "@/lib/format";
import { useAutomation } from "./context";
import type { CatalogTree } from "./new-run-dialog";
import { RunCard } from "./run-card";
import { RUN_STATUS } from "./status";

type RunsPage = { days: { date: string; count: number; runs: RunCardData[] }[]; total: number; page: number; pages: number };

const STARTED = [
  { key: "", label: "All" },
  { key: "on-demand", label: "On demand" },
  { key: "scheduled", label: "Scheduled" },
];

export function RunsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { version, openNewRun } = useAutomation();
  const get = (key: string) => params.get(key) ?? "";
  const [q, setQ] = useState(get("q"));

  /** Every filter lives in the URL, so a filtered list can be shared and Back works. */
  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  // The search box writes to the URL a moment after typing stops.
  useEffect(() => {
    if (q === get("q")) return;
    const timer = window.setTimeout(() => update({ q }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const period = get("period") as PeriodKey | "";
  const customProblem = period === "custom" ? validateCustom(get("from") || null, get("to") || null) : null;
  const apiParams = new URLSearchParams();
  const started = get("started");
  if (started) apiParams.set("started", started === "on-demand" ? "on_demand" : "scheduled");
  for (const key of ["module", "feature", "status", "period", "from", "to", "q", "page"]) if (get(key)) apiParams.set(key, get(key));
  const url = customProblem ? null : `/api/automation/runs?${apiParams}&v=${version}`;
  const runs = useResource<RunsPage>(url, 5000);
  const catalog = useResource<CatalogTree>("/api/automation/catalog");
  const modules = catalog.data?.tree ?? [];
  const features = modules.find((m) => m.module === get("module"))?.features ?? [];
  const hasFilters = ["module", "feature", "status", "period", "q"].some((key) => get(key));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1 border-b border-line">
        {STARTED.map((tab) => (
          <button
            key={tab.key}
            onClick={() => update({ started: tab.key })}
            aria-current={started === tab.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-base font-medium",
              started === tab.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.3fr)]">
        <Select aria-label="Module" value={get("module")} onChange={(e) => update({ module: e.target.value, feature: "" })}>
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m.module} value={m.module}>
              {m.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Feature" value={get("feature")} disabled={!get("module")} onChange={(e) => update({ feature: e.target.value })}>
          <option value="">All features</option>
          {features.map((f) => (
            <option key={f.feature} value={f.feature}>
              {f.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Status" value={get("status")} onChange={(e) => update({ status: e.target.value })}>
          <option value="">Any status</option>
          {Object.entries(RUN_STATUS).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Period" value={period} onChange={(e) => update({ period: e.target.value, from: "", to: "" })}>
          <option value="">Any time</option>
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
          <Input aria-label="Search runs" className="pl-8" placeholder="Run ID or test name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {period === "custom" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            From
            <Input type="date" value={get("from")} onChange={(e) => update({ from: e.target.value })} className="w-40" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            To
            <Input type="date" value={get("to")} onChange={(e) => update({ to: e.target.value })} className="w-40" />
          </label>
          {customProblem ? (
            <p className="pb-1.5 text-sm text-fail" role="alert">
              {customProblem}
            </p>
          ) : null}
        </div>
      ) : null}

      {hasFilters ? (
        <div>
          <Button size="sm" variant="ghost" onClick={() => { setQ(""); update({ module: "", feature: "", status: "", period: "", from: "", to: "", q: "" }); }}>
            <X className="size-3.5" aria-hidden /> Clear all
          </Button>
        </div>
      ) : null}

      {customProblem ? null : runs.loading && !runs.data ? (
        <SkeletonRows rows={6} className="[&>div]:h-24" />
      ) : runs.error ? (
        <ErrorState message={runs.error} onRetry={runs.reload} />
      ) : !runs.data || runs.data.total === 0 ? (
        hasFilters ? (
          <EmptyState title="No runs match these filters." />
        ) : (
          <EmptyState title="No runs yet." action={<Button variant="primary" onClick={() => openNewRun()}>New run</Button>} />
        )
      ) : (
        <>
          {runs.data.days.map((day) => (
            <section key={day.date} className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-2 text-sm font-semibold">
                {formatDay(day.date + "T12:00:00")}
                <span className="font-normal text-muted">{plural(day.count, "run")}</span>
              </h2>
              {day.runs.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </section>
          ))}
          {runs.data.pages > 1 ? (
            <nav className="flex items-center justify-between gap-2 pt-2" aria-label="Pages">
              <Button size="sm" disabled={runs.data.page <= 1} onClick={() => update({ page: String(runs.data!.page - 1) })}>
                Previous
              </Button>
              <span className="tabular text-sm text-muted">
                Page {runs.data.page} of {runs.data.pages}
              </span>
              <Button size="sm" disabled={runs.data.page >= runs.data.pages} onClick={() => update({ page: String(runs.data!.page + 1) })}>
                Next
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
