"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Download, FolderTree, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { api, useResource } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatRelative, plural } from "@/lib/format";
import {
  type CaseState,
  type CaseSummary,
  caseCode,
  childrenOf,
  LABELS,
  matchesSearch,
  pathOf,
  PRIORITIES,
  type Priority,
  type Project,
  STATES,
  subtreeIds,
  toCsv,
  type TreeNode,
} from "@/lib/test-plans/model";
import { CaseSheet } from "./case-sheet";
import { PlanTree, type Scope } from "./tree";

type Workspace = { projects: Project[]; nodes: TreeNode[]; cases: CaseSummary[]; canWrite: boolean };
type SortKey = "id" | "title" | "priority" | "state";
type DeletedItem = { batch: string; kind: "project" | "suite" | "folder" | "cases"; name: string; deletedAt: string; folders: number; cases: number };

const STATE_TONE: Record<CaseState, Tone> = { draft: "neutral", active: "accent", deprecated: "skip" };
const RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3, draft: 0, active: 1, deprecated: 2 };

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export function TestPlansView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const data = useResource<Workspace>("/api/test-plans");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [state, setState] = useState<CaseState | "">("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "id", desc: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // A test case created in the sheet keeps the same sheet when the URL changes from "new" to its id.
  const [created, setCreated] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const ws = data.data;
  const caseParam = params.get("case");

  // The scope comes from the URL; without one it is the first project, all suites.
  const scope: Scope | null = useMemo(() => {
    if (!ws) return null;
    const nodeId = params.get("node");
    const node = nodeId ? ws.nodes.find((n) => n.id === nodeId) : undefined;
    if (node) return { projectId: node.projectId, nodeId: node.id };
    const fromCase = caseParam ? ws.cases.find((c) => c.id === caseParam)?.projectId : undefined;
    const projectId = params.get("project");
    const project = ws.projects.find((p) => p.id === (fromCase ?? projectId)) ?? ws.projects[0];
    return project ? { projectId: project.id, nodeId: null } : null;
  }, [ws, params, caseParam]);

  const setUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const select = (next: Scope) => {
    setSelected(new Set());
    setTreeOpen(false);
    setUrl({ project: next.projectId || null, node: next.nodeId });
  };

  const openCase = useCallback(
    (id: string) => setUrl({ case: id }),
    [setUrl],
  );

  const scopeCases = useMemo(() => {
    if (!ws || !scope) return [];
    const ids = scope.nodeId ? new Set(subtreeIds(ws.nodes, scope.nodeId)) : null;
    return ws.cases.filter((c) => c.projectId === scope.projectId && (!ids || ids.has(c.nodeId)));
  }, [ws, scope]);

  const rows = useMemo(() => {
    const filtered = scopeCases.filter((c) => matchesSearch(c, query) && (!priority || c.priority === priority) && (!state || c.state === state));
    const value = (c: CaseSummary) => (sort.key === "id" ? c.number : sort.key === "title" ? c.title.toLowerCase() : RANK[c[sort.key]]);
    return filtered.sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      const order = x < y ? -1 : x > y ? 1 : a.number - b.number;
      return sort.desc ? -order : order;
    });
  }, [scopeCases, query, priority, state, sort]);

  // Where a new test case goes: the selected node, or the first suite of the project.
  const newCaseNode = scope && ws ? (scope.nodeId ?? childrenOf(ws.nodes, scope.projectId, null)[0]?.id ?? null) : null;
  const canWrite = ws?.canWrite ?? false;

  const newCase = useCallback(() => {
    if (!canWrite) return;
    if (!scope) return toast.error("Create a project first.");
    if (!newCaseNode) return toast.error("Add a suite to the project first.");
    openCase("new");
  }, [canWrite, scope, newCaseNode, openCase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target) || document.querySelector("[role=dialog]")) return;
      if (event.key === "/") {
        event.preventDefault();
        search.current?.focus();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        newCase();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [newCase]);

  if (data.error) return <ErrorState message={data.error} onRetry={data.reload} />;
  if (!ws) return <SkeletonRows rows={8} />;

  const project = ws.projects.find((p) => p.id === scope?.projectId);
  const crumbs = scope?.nodeId ? pathOf(ws.nodes, scope.nodeId).map((n) => ({ label: n.name, href: `/test-plans?node=${n.id}` })) : [{ label: "All suites" }];
  const visibleIds = rows.map((r) => r.id);
  const chosen = visibleIds.filter((id) => selected.has(id));
  const allChosen = chosen.length > 0 && chosen.length === visibleIds.length;
  const hasSuites = scope ? ws.nodes.some((n) => n.projectId === scope.projectId) : false;

  function exportCsv() {
    const header = ["ID", "Title", "Priority", "State", "Tags", "Suite", "Automation"];
    const lines = rows.map((c) => [caseCode(c.number), c.title, LABELS[c.priority], LABELS[c.state], c.tags.join(" "), pathOf(ws!.nodes, c.nodeId).map((n) => n.name).join(" / "), LABELS[c.automation]]);
    const blob = new Blob(["﻿" + toCsv([header, ...lines])], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `test-cases-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function bulkDelete() {
    confirm.ask("Delete these test cases?", <>{plural(chosen.length, "test case")} will go to Deleted. You can restore them from there.</>, "Delete", async () => {
      try {
        await api("/api/test-plans/cases/bulk-delete", { body: { ids: chosen } });
        toast.success(`${plural(chosen.length, "test case")} moved to Deleted.`);
        setSelected(new Set());
        data.refresh();
      } catch (error) {
        toast.error((error as Error).message);
      }
    });
  }

  const sortHeader = (key: SortKey, label: string, className?: string) => (
    <th className={cn("px-3 py-2 font-medium", className)} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : false })}>
        {label}
        {sort.key === key ? sort.desc ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden /> : null}
      </button>
    </th>
  );

  const tree = (
    <PlanTree projects={ws.projects} nodes={ws.nodes} cases={ws.cases} scope={scope} canWrite={canWrite} onSelect={select} onChanged={data.refresh} />
  );
  const treeFooter = (
    <TreeFooter canWrite={canWrite} onDeleted={() => setDeletedOpen(true)} onImported={data.refresh} />
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Test Plans" }]}
        title="Test Plans"
        actions={
          <>
            <Button className="lg:hidden" onClick={() => setTreeOpen(true)}>
              <FolderTree className="size-4" aria-hidden /> Projects
            </Button>
            {canWrite ? (
              <Button variant="primary" onClick={newCase} disabled={!newCaseNode} title="New test case (N)" data-testid="new-case">
                <Plus className="size-4" aria-hidden /> New test case
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="hidden self-start lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-48px)] lg:flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">{tree}</div>
          {treeFooter}
        </Card>

        <div className="flex min-w-0 flex-col gap-3">
          <Breadcrumbs items={project ? [{ label: project.name, href: `/test-plans?project=${project.id}` }, ...crumbs] : [{ label: "No project" }]} />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-[1_1_240px]">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
              <Input ref={search} aria-label="Search test cases" className="pr-8 pl-8" placeholder="Search by title, ID or tag" value={query} onChange={(e) => setQuery(e.target.value)} />
              <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-xs text-faint sm:block" aria-hidden>
                /
              </kbd>
            </div>
            <Select aria-label="Priority" className="w-36" value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")}>
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {LABELS[p]}
                </option>
              ))}
            </Select>
            <Select aria-label="State" className="w-32" value={state} onChange={(e) => setState(e.target.value as CaseState | "")}>
              <option value="">All states</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {LABELS[s]}
                </option>
              ))}
            </Select>
            <Button onClick={exportCsv} disabled={!rows.length}>
              <Download className="size-4" aria-hidden /> Export CSV
            </Button>
          </div>

          {canWrite && chosen.length ? (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-3 py-2" role="status">
              <span className="text-sm font-medium">{chosen.length} selected</span>
              <Button size="sm" variant="danger" onClick={bulkDelete}>
                <Trash2 className="size-3.5" aria-hidden /> Delete
              </Button>
              <button type="button" className="ml-auto text-sm text-muted hover:text-ink" onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
            </div>
          ) : null}

          {!scope ? (
            <EmptyState title={canWrite ? "No projects yet. Create a project, then add a suite to get started." : "No projects yet."} />
          ) : !hasSuites ? (
            <EmptyState title="Add a suite to get started." />
          ) : !scopeCases.length ? (
            <EmptyState title="No test cases yet." action={canWrite ? <Button variant="primary" onClick={newCase}>New test case</Button> : undefined} />
          ) : !rows.length ? (
            <EmptyState
              title="No test cases match."
              action={
                <Button
                  onClick={() => {
                    setQuery("");
                    setPriority("");
                    setState("");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              <table className="w-full table-fixed text-base">
                <thead className="hidden md:table-header-group">
                  <tr className="border-b border-line bg-subtle text-left text-sm text-muted">
                    {canWrite ? (
                      <th className="w-10 px-3 py-2">
                        <Checkbox
                          aria-label="Select all"
                          checked={allChosen ? true : chosen.length ? "indeterminate" : false}
                          onCheckedChange={(value) => setSelected(value ? new Set(visibleIds) : new Set())}
                        />
                      </th>
                    ) : null}
                    {sortHeader("id", "ID", "w-24")}
                    {sortHeader("title", "Title")}
                    {sortHeader("priority", "Priority", "w-28")}
                    {sortHeader("state", "State", "w-32")}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className={cn("flex cursor-pointer flex-wrap items-center gap-x-3 border-b border-line px-1 py-1 last:border-b-0 hover:bg-subtle md:table-row md:p-0", caseParam === c.id && "bg-accent-soft hover:bg-accent-soft")}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button,[role=checkbox],a")) return;
                        openCase(c.id);
                      }}
                      data-testid="case-row"
                    >
                      {canWrite ? (
                        <td className="px-2 py-2 md:px-3">
                          <Checkbox
                            aria-label={`Select ${caseCode(c.number)}`}
                            checked={selected.has(c.id)}
                            onCheckedChange={(value) => {
                              const next = new Set(selected);
                              if (value) next.add(c.id);
                              else next.delete(c.id);
                              setSelected(next);
                            }}
                          />
                        </td>
                      ) : null}
                      <td className="px-1 py-2 font-mono text-sm text-muted md:px-3">{caseCode(c.number)}</td>
                      <td className="order-last w-full min-w-0 px-2 pb-2 md:order-none md:w-auto md:px-3 md:py-2">
                        <button type="button" onClick={() => openCase(c.id)} className="block max-w-full truncate text-left font-medium hover:underline" title={c.title}>
                          {c.title}
                        </button>
                        {c.tags.length ? <p className="truncate text-xs text-muted">{c.tags.join(", ")}</p> : null}
                      </td>
                      <td className={cn("px-1 py-2 text-sm md:px-3", c.priority === "critical" || c.priority === "high" ? "font-medium text-ink" : "text-muted")}>{LABELS[c.priority]}</td>
                      <td className="px-1 py-2 md:px-3">
                        <Badge tone={STATE_TONE[c.state]}>{LABELS[c.state]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {scope && rows.length ? (
            <p className="text-sm text-muted">
              {rows.length === scopeCases.length ? plural(rows.length, "test case") : `${rows.length} of ${plural(scopeCases.length, "test case")}`}
            </p>
          ) : null}
        </div>
      </div>

      <RadixDialog.Root open={treeOpen} onOpenChange={setTreeOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/30 lg:hidden" />
          <RadixDialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 flex w-[min(320px,88vw)] flex-col border-r border-line bg-surface focus:outline-none lg:hidden">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <RadixDialog.Title className="text-base font-semibold">Projects</RadixDialog.Title>
              <RadixDialog.Close aria-label="Close" className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink">
                <X className="size-4" />
              </RadixDialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{tree}</div>
            {treeFooter}
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      {deletedOpen ? (
        <DeletedDialog
          canWrite={canWrite}
          onClose={() => setDeletedOpen(false)}
          onRestored={data.refresh}
        />
      ) : null}

      {caseParam && scope && (caseParam !== "new" || newCaseNode) ? (
        <CaseSheet
          key={caseParam === created ? "new" : caseParam}
          caseId={caseParam === "new" ? null : caseParam}
          projectId={scope.projectId}
          defaultNodeId={newCaseNode ?? ""}
          nodes={ws.nodes}
          canWrite={canWrite}
          onClose={() => setUrl({ case: null })}
          onSaved={(id) => {
            data.refresh();
            if (caseParam === "new") {
              setCreated(id);
              setUrl({ case: id });
            }
          }}
          onOpenCase={openCase}
        />
      ) : null}
      {confirm.dialog}
    </>
  );
}

function TreeFooter({ canWrite, onDeleted, onImported }: { canWrite: boolean; onDeleted: () => void; onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: unknown; projects: number; cases: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function read(files: FileList | null) {
    const file = files?.[0];
    if (input.current) input.current.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { projects?: { suites?: unknown[] }[] };
      if (!Array.isArray(parsed.projects)) throw new Error();
      let cases = 0;
      const count = (node: { cases?: unknown[]; folders?: unknown[] }): void => {
        cases += node.cases?.length ?? 0;
        for (const child of node.folders ?? []) count(child as typeof node);
      };
      for (const project of parsed.projects) for (const suite of project.suites ?? []) count(suite as { cases?: unknown[] });
      setPending({ file: parsed, projects: parsed.projects.length, cases });
    } catch {
      toast.error("This is not a Test Plans export file.");
    }
  }

  async function runImport() {
    if (!pending) return;
    setBusy(true);
    try {
      const report = await api<{ projects: number; suites: number; folders: number; cases: number }>("/api/test-plans/import", { body: pending.file });
      toast.success(`Imported ${plural(report.projects, "project")}, ${plural(report.suites, "suite")}, ${plural(report.folders, "folder")} and ${plural(report.cases, "test case")}.`, { duration: 8000 });
      setPending(null);
      onImported();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col border-t border-line p-1.5 text-base">
      <FooterButton onClick={onDeleted} icon={Trash2}>
        Deleted
      </FooterButton>
      <a href="/api/test-plans/export" download className="flex h-8 items-center gap-2 rounded-md px-2 text-muted hover:bg-hover hover:text-ink">
        <Download className="size-4" aria-hidden /> Export JSON
      </a>
      {canWrite ? (
        <>
          <FooterButton onClick={() => input.current?.click()} icon={Upload}>
            Import JSON
          </FooterButton>
          <input ref={input} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => read(e.target.files)} />
        </>
      ) : null}
      {pending ? (
        <Dialog open onOpenChange={(open) => !open && setPending(null)}>
          <DialogContent
            title="Import test plans?"
            size="sm"
            footer={
              <>
                <Button onClick={() => setPending(null)}>Cancel</Button>
                <Button variant="primary" onClick={runImport} disabled={busy}>
                  {busy ? "Importing..." : "Import"}
                </Button>
              </>
            }
          >
            <p className="text-base text-muted">
              {plural(pending.projects, "project")} with {plural(pending.cases, "test case")} will be added as new projects. Nothing that is here now changes.
            </p>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function FooterButton({ onClick, icon: Icon, children }: { onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-muted hover:bg-hover hover:text-ink">
      <Icon className="size-4" aria-hidden /> {children}
    </button>
  );
}

function DeletedDialog({ canWrite, onClose, onRestored }: { canWrite: boolean; onClose: () => void; onRestored: () => void }) {
  const list = useResource<{ items: DeletedItem[] }>("/api/test-plans/deleted");
  const [busy, setBusy] = useState<string | null>(null);
  const kindLabel: Record<DeletedItem["kind"], string> = { project: "Project", suite: "Suite", folder: "Folder", cases: "Test case" };

  async function restore(item: DeletedItem) {
    setBusy(item.batch);
    try {
      await api("/api/test-plans/deleted", { body: { batch: item.batch } });
      toast.success(`${item.name} restored.`);
      list.refresh();
      onRestored();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="Deleted" description="Restoring brings back everything that was deleted with it." size="md">
        {list.loading && !list.data ? (
          <SkeletonRows rows={3} />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data?.items.length ? (
          <p className="py-4 text-center text-base text-muted">Nothing is deleted.</p>
        ) : (
          <ul className="-my-2">
            {list.data.items.map((item) => (
              <li key={item.batch} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2.5 last:border-b-0" data-testid="deleted-item">
                <div className="min-w-0 flex-[1_1_240px]">
                  <p className="truncate font-medium" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-sm text-muted">
                    {item.kind === "cases" && item.cases > 1 ? "Test cases" : kindLabel[item.kind]}
                    {item.kind !== "cases" && (item.folders || item.cases)
                      ? ` with ${[item.folders ? plural(item.folders, item.kind === "project" ? "suite or folder" : "folder", item.kind === "project" ? "suites and folders" : "folders") : null, item.cases ? plural(item.cases, "test case") : null].filter(Boolean).join(" and ")}`
                      : ""}
                    , deleted {formatRelative(item.deletedAt)}
                  </p>
                </div>
                {canWrite ? (
                  <Button size="sm" onClick={() => restore(item)} disabled={busy === item.batch}>
                    Restore
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
