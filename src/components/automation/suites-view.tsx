"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Input, Select } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreButton } from "@/components/ui/menu";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import type { RunStatus } from "@/lib/automation/types";
import { api, useResource } from "@/lib/client/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useAutomation } from "./context";
import { RunStatusBadge } from "./status";

type SuiteRow = {
  id: string;
  name: string;
  description: string;
  testCount: number;
  costly: boolean;
  lastRun: { id: string; number: number; status: RunStatus; at: string } | null;
  createdBy: string | null;
  updatedAt: string;
};

export async function runSuite(suite: { id: string; name: string }, bump: () => void, push: (url: string) => void) {
  try {
    const run = await api<{ id: string }>("/api/automation/runs", {
      body: { target: { kind: "suite", suiteId: suite.id, suiteName: suite.name }, testSet: "full", includeCostly: false, headed: false, watch: false },
    });
    bump();
    push(`/automation-test/runs/${run.id}`);
  } catch (error) {
    toast.error((error as Error).message);
  }
}

export function SuitesView() {
  const router = useRouter();
  const { version, bump, openNewRun } = useAutomation();
  const list = useResource<{ suites: SuiteRow[] }>(`/api/automation/suites?v=${version}`);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"updated" | "name" | "tests">("updated");
  const confirm = useConfirm();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.data?.suites ?? [])
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "tests" ? b.testCount - a.testCount : b.updatedAt.localeCompare(a.updatedAt)));
  }, [list.data, query, sort]);

  function menu(s: SuiteRow) {
    return (
      <DropdownMenu>
        <MoreButton label={`Actions for ${s.name}`} />
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <Link href={`/automation-test/suites/${s.id}`}>Open</Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={s.testCount === 0} onSelect={() => runSuite(s, bump, router.push)}>
            Run
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openNewRun({ mode: "schedule", target: { kind: "suite", suiteId: s.id, suiteName: s.name } })}>Schedule</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            danger
            onSelect={() =>
              confirm.ask("Delete this suite?", <>{s.name} will be deleted. Its runs stay in the history; schedules that use it stop finding tests.</>, "Delete", async () => {
                try {
                  await api(`/api/automation/suites/${s.id}`, { method: "DELETE" });
                  toast.success("Suite deleted.");
                  list.refresh();
                } catch (error) {
                  toast.error((error as Error).message);
                }
              })
            }
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[1_1_220px]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
          <Input aria-label="Search suites" className="pl-8" placeholder="Search suites" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select aria-label="Sort" className="w-44" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="updated">Sort: last updated</option>
          <option value="name">Sort: name</option>
          <option value="tests">Sort: most tests</option>
        </Select>
        <Link href="/automation-test/suites/new" className={buttonClass()}>
          <Plus className="size-4" aria-hidden /> New suite
        </Link>
      </div>

      {list.loading && !list.data ? (
        <SkeletonRows rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data?.suites.length ? (
        <EmptyState title="No suites yet. A suite is a saved set of tests you can run or schedule." action={<Link href="/automation-test/suites/new" className={buttonClass({ variant: "primary" })}>New suite</Link>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No suites match." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full table-fixed text-base">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-line bg-subtle text-left text-sm text-muted">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Tests</th>
                <th className="w-[18%] px-3 py-2 font-medium">Last run</th>
                <th className="w-[15%] px-3 py-2 font-medium">Created by</th>
                <th className="w-[14%] px-3 py-2 font-medium">Updated</th>
                <th className="w-12 px-3 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="flex flex-wrap items-center border-b border-line last:border-b-0 hover:bg-subtle md:table-row" data-testid="suite-row">
                  <td className="min-w-0 flex-1 px-4 py-2.5">
                    <Link href={`/automation-test/suites/${s.id}`} className="block truncate font-medium hover:underline" title={s.name}>
                      {s.name}
                    </Link>
                    {s.description ? <p className="truncate text-sm text-muted" title={s.description}>{s.description}</p> : null}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right md:table-cell">
                    {s.testCount}
                    {s.costly ? <Badge tone="flaky" className="ml-1.5">LLM</Badge> : null}
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {s.lastRun ? (
                      <Link href={`/automation-test/runs/${s.lastRun.id}`} className="inline-flex items-center gap-2 hover:underline" title={formatDateTime(s.lastRun.at)}>
                        <RunStatusBadge status={s.lastRun.status} />
                        <span className="text-sm text-muted">{formatRelative(s.lastRun.at)}</span>
                      </Link>
                    ) : (
                      <span className="text-sm text-muted">Never</span>
                    )}
                  </td>
                  <td className="hidden truncate px-3 py-2.5 text-muted md:table-cell">{s.createdBy ?? "-"}</td>
                  <td className="hidden px-3 py-2.5 text-sm text-muted md:table-cell" title={formatDateTime(s.updatedAt)}>
                    {formatRelative(s.updatedAt)}
                  </td>
                  <td className="px-3 py-2.5 text-right">{menu(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirm.dialog}
    </div>
  );
}
