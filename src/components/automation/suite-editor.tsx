"use client";

import { AlertTriangle, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm";
import { Field, Input, Textarea } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, MoreButton } from "@/components/ui/menu";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { fileLabel, label, resolveTests, type TreeModule } from "@/lib/automation/catalog";
import type { RunCard as RunCardData } from "@/lib/automation/runs-data";
import { putBack, stateOf, testsOf, toggle, unavailable } from "@/lib/automation/suite-selection";
import type { CatalogTest, SelectionItem, SuiteItems } from "@/lib/automation/types";
import { api, useResource } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { useAutomation } from "./context";
import { AutomationHeader } from "./header";
import { RunCard } from "./run-card";
import { runSuite } from "./suites-view";

type CatalogWithTests = { tree: TreeModule[]; error: string | null };
type SuiteData = { suite: { id: string; name: string; description: string; items: SuiteItems }; runs: RunCardData[] };

function itemLabel(item: SelectionItem, tests: CatalogTest[]): string {
  if (item.kind === "module") return label(item.module);
  if (item.kind === "feature") return `${label(item.module)} / ${label(item.feature)}`;
  if (item.kind === "file") return fileLabel(item.file);
  const test = tests.find((t) => t.nodeid === item.nodeid);
  return test ? `${test.testCaseId ?? ""} ${test.title}`.trim() : item.nodeid;
}

export function SuiteEditor({ suiteId }: { suiteId: string | null }) {
  const router = useRouter();
  const { bump, openNewRun } = useAutomation();
  const catalog = useResource<CatalogWithTests>("/api/automation/catalog?tests=1");
  const existing = useResource<SuiteData>(suiteId ? `/api/automation/suites/${suiteId}` : null);
  const [draft, setDraft] = useState<{ name: string; description: string; items: SuiteItems } | null>(suiteId ? null : { name: "", description: "", items: { include: [], exclude: [] } });
  const [saved, setSaved] = useState<string>(suiteId ? "" : JSON.stringify({ name: "", description: "", items: { include: [], exclude: [] } }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  // The suite is copied into the draft once it arrives.
  if (suiteId && existing.data && draft === null) {
    const { name, description, items } = existing.data.suite;
    setDraft({ name, description, items });
    setSaved(JSON.stringify({ name, description, items }));
  }

  const dirty = draft !== null && JSON.stringify(draft) !== saved;
  const tree = useMemo(() => catalog.data?.tree ?? [], [catalog.data]);
  const allTests = useMemo(() => tree.flatMap((m) => m.features.flatMap((f) => f.files.flatMap((file) => file.tests))), [tree]);

  // Leaving with unsaved changes asks first: the browser for reloads and closing, our dialog for links.
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor || anchor.target === "_blank" || !anchor.href.startsWith(window.location.origin)) return;
      event.preventDefault();
      event.stopPropagation();
      confirm.ask("Leave without saving?", "Your changes to this suite will be lost.", "Leave", () => {
        setSaved(JSON.stringify(draft));
        router.push(anchor.href.slice(window.location.origin.length));
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, draft, confirm, router]);

  if (existing.error) {
    return (
      <>
        <AutomationHeader tab={null} title="Suite" crumbs={[{ label: "Suites", href: "/automation-test/suites" }, { label: "Suite" }]} />
        {existing.error === "Suite not found." ? (
          <EmptyState title="This suite does not exist. It may have been deleted." action={<Link href="/automation-test/suites" className={buttonClass()}>All suites</Link>} />
        ) : (
          <ErrorState message={existing.error} onRetry={existing.reload} />
        )}
      </>
    );
  }
  if (!draft || (catalog.loading && !catalog.data)) {
    return (
      <>
        <AutomationHeader tab={null} title={suiteId ? "Suite" : "New suite"} crumbs={[{ label: "Suites", href: "/automation-test/suites" }, { label: suiteId ? "Suite" : "New suite" }]} />
        <SkeletonRows rows={6} />
      </>
    );
  }

  const chosen = resolveTests(allTests, draft.items.include, { exclude: draft.items.exclude, testSet: "full", includeCostly: true });
  const costly = chosen.filter((t) => t.markers.includes("costly")).length;
  const gone = unavailable(draft.items, tree);
  const setItems = (items: SuiteItems) => setDraft({ ...draft, items });

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError("Give the suite a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (suiteId) {
        await api(`/api/automation/suites/${suiteId}`, { method: "PUT", body: draft });
        setSaved(JSON.stringify(draft));
        toast.success("Suite saved.");
      } else {
        const created = await api<{ id: string }>("/api/automation/suites", { body: draft });
        setSaved(JSON.stringify(draft));
        toast.success("Suite created.");
        router.replace(`/automation-test/suites/${created.id}`);
      }
      bump();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (!suiteId) router.push("/automation-test/suites");
    else setDraft(JSON.parse(saved) as typeof draft);
  }

  const title = suiteId ? existing.data?.suite.name ?? "Suite" : "New suite";
  return (
    <>
      <AutomationHeader
        tab={null}
        title={title}
        crumbs={[{ label: "Suites", href: "/automation-test/suites" }, { label: title }]}
        actions={
          suiteId && !dirty ? (
            <>
              <Button disabled={chosen.length === 0} onClick={() => runSuite({ id: suiteId, name: draft.name }, bump, router.push)}>
                Run
              </Button>
              <Button onClick={() => openNewRun({ mode: "schedule", target: { kind: "suite", suiteId, suiteName: draft.name } })}>Schedule</Button>
              <DropdownMenu>
                <MoreButton label="More suite actions" />
                <DropdownMenuContent>
                  <DropdownMenuItem
                    danger
                    onSelect={() =>
                      confirm.ask("Delete this suite?", <>{draft.name} will be deleted. Its runs stay in the history.</>, "Delete", async () => {
                        await api(`/api/automation/suites/${suiteId}`, { method: "DELETE" });
                        toast.success("Suite deleted.");
                        router.push("/automation-test/suites");
                      })
                    }
                  >
                    Delete suite
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null
        }
      />

      <div className="flex flex-col gap-5">
        <Card className="flex flex-col gap-3 p-4">
          <Field label="Name" error={error}>
            {(props) => <Input {...props} value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Fleet regression" />}
          </Field>
          <Field label="Description">
            {(props) => <Textarea {...props} rows={2} value={draft.description} maxLength={500} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />}
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={save} disabled={saving || (!dirty && Boolean(suiteId))} data-testid="suite-save">
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button onClick={cancel} disabled={Boolean(suiteId) && !dirty}>
              Cancel
            </Button>
            {dirty ? <span className="text-sm text-flaky">Unsaved changes</span> : null}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <TestTree tree={tree} items={draft.items} onChange={setItems} catalogError={catalog.data?.error ?? catalog.error} />
          <Card className="self-start lg:sticky lg:top-6">
            <CardHeader title="In this suite" description={plural(chosen.length, "test")} />
            <div className="flex flex-col gap-3 px-4 py-3">
              {draft.items.include.length === 0 ? <p className="text-base text-muted">Nothing chosen yet. Tick modules, features, files or tests on the left.</p> : null}
              <ul className="flex flex-col gap-1">
                {draft.items.include.map((item) => (
                  <li key={JSON.stringify(item)} className="flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-base", gone.includes(item) && "text-fail line-through")} title={itemLabel(item, allTests)}>
                      {itemLabel(item, allTests)}
                    </span>
                    <span className="tabular shrink-0 text-xs text-faint">{testsOf(item, tree).length}</span>
                    <button className="rounded p-1 text-muted hover:bg-hover hover:text-fail" aria-label={`Remove ${itemLabel(item, allTests)}`} onClick={() => setItems({ ...draft.items, include: draft.items.include.filter((i) => i !== item) })}>
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              {gone.length ? <p className="text-sm text-fail">{plural(gone.length, "item")} no longer in the tests (deleted or moved).</p> : null}
              {draft.items.exclude.length ? (
                <div className="flex flex-col gap-1 rounded-md bg-subtle px-3 py-2">
                  <p className="text-sm font-medium">{plural(draft.items.exclude.length, "test")} left out</p>
                  {draft.items.exclude.map((nodeid) => (
                    <div key={nodeid} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-muted">{itemLabel({ kind: "test", nodeid }, allTests)}</span>
                      <button className="shrink-0 text-accent hover:underline" onClick={() => setItems(putBack(draft.items, nodeid))}>
                        Put back
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {costly ? (
                <p className="flex items-start gap-2 text-sm text-flaky">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {plural(costly, "test")} can spend LLM credits; a run asks before including them.
                </p>
              ) : null}
            </div>
          </Card>
        </div>

        {suiteId ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">Runs of this suite</h2>
            {existing.data?.runs.length ? existing.data.runs.map((run) => <RunCard key={run.id} run={run} />) : <p className="text-base text-muted">This suite has not run yet.</p>}
          </section>
        ) : null}
      </div>
      {confirm.dialog}
    </>
  );
}

function TestTree({
  tree,
  items,
  onChange,
  catalogError,
}: {
  tree: TreeModule[];
  items: SuiteItems;
  onChange: (items: SuiteItems) => void;
  catalogError: string | null;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<Record<string, { tests?: CatalogTest[]; error?: string; loading?: boolean }>>({});
  const q = query.trim().toLowerCase();

  async function openFile(file: string) {
    setFiles((current) => ({ ...current, [file]: { loading: true } }));
    try {
      const data = await api<{ tests: CatalogTest[] }>(`/api/automation/catalog/file?file=${encodeURIComponent(file)}`);
      setFiles((current) => ({ ...current, [file]: { tests: data.tests } }));
    } catch (error) {
      setFiles((current) => ({ ...current, [file]: { error: (error as Error).message } }));
    }
  }

  const flip = (key: string, fileToLoad?: string) => {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else {
      next.add(key);
      if (fileToLoad && !files[fileToLoad]?.tests) void openFile(fileToLoad);
    }
    setOpen(next);
  };
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const ids = (item: SelectionItem) => testsOf(item, tree);
  const featureCount = tree.reduce((sum, m) => sum + m.features.length, 0);
  const fileCount = tree.reduce((sum, m) => sum + m.features.reduce((s, f) => s + f.files.length, 0), 0);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="relative min-w-0 flex-[1_1_200px]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
          <Input aria-label="Search tests" className="pl-8" placeholder="Search modules, features, files, tests" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <p className="text-sm text-muted">
          {plural(featureCount, "feature")} · {plural(fileCount, "file")} · {plural(tree.reduce((s, m) => s + m.testCount, 0), "test")}
        </p>
      </div>
      {catalogError ? <p className="border-b border-line px-4 py-2 text-sm text-fail">{catalogError}</p> : null}
      <ul className="py-1" aria-label="Tests">
        {tree.map((module) => {
          const moduleItem: SelectionItem = { kind: "module", module: module.module };
          const visibleFeatures = module.features.filter(
            (f) => matches(module.label) || matches(f.label) || f.files.some((file) => matches(file.label) || file.tests.some((t) => matches(t.title) || matches(t.testCaseId ?? ""))),
          );
          if (q && visibleFeatures.length === 0) return null;
          const moduleOpen = open.has(module.module) || Boolean(q);
          return (
            <li key={module.module}>
              <Row depth={0} open={moduleOpen} onToggle={() => flip(module.module)} checked={stateOf(items, tree, ids(moduleItem))} onCheck={(on) => onChange(toggle(items, tree, moduleItem, on))} text={module.label} count={module.testCount} strong />
              {moduleOpen ? (
                <ul>
                  {visibleFeatures.map((feature) => {
                    const featureItem: SelectionItem = { kind: "feature", module: feature.module, feature: feature.feature };
                    const key = `${module.module}|${feature.feature}`;
                    const featureOpen = open.has(key) || Boolean(q);
                    return (
                      <li key={key}>
                        <Row depth={1} open={featureOpen} onToggle={() => flip(key)} checked={stateOf(items, tree, ids(featureItem))} onCheck={(on) => onChange(toggle(items, tree, featureItem, on))} text={feature.label} count={feature.testCount} />
                        {featureOpen ? (
                          <ul>
                            {feature.files.map((file) => {
                              const fileItem: SelectionItem = { kind: "file", file: file.file };
                              const fileOpen = open.has(file.file);
                              const loaded = files[file.file];
                              return (
                                <li key={file.file}>
                                  <Row depth={2} open={fileOpen} onToggle={() => flip(file.file, file.file)} checked={stateOf(items, tree, ids(fileItem))} onCheck={(on) => onChange(toggle(items, tree, fileItem, on))} text={`${file.label} (${file.role.replace(/-/g, " ")})`} count={file.tests.length} />
                                  {fileOpen ? (
                                    <ul>
                                      {loaded?.loading ? <li className="py-1.5 pl-[92px] text-sm text-muted">Reading the tests...</li> : null}
                                      {loaded?.error ? (
                                        <li className="flex items-center gap-2 py-1.5 pl-[92px] text-sm text-fail">
                                          Could not read {file.label}: {loaded.error}
                                          <Button size="sm" onClick={() => openFile(file.file)}>
                                            Try again
                                          </Button>
                                        </li>
                                      ) : null}
                                      {loaded?.tests?.map((test) => {
                                        const testItem: SelectionItem = { kind: "test", nodeid: test.nodeid };
                                        return (
                                          <li key={test.nodeid}>
                                            <Row depth={3} checked={stateOf(items, tree, [test.nodeid])} onCheck={(on) => onChange(toggle(items, tree, testItem, on))} text={`${test.testCaseId ?? ""} ${test.title}`.trim()} />
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Row({
  depth,
  open,
  onToggle,
  checked,
  onCheck,
  text,
  count,
  strong,
}: {
  depth: number;
  open?: boolean;
  onToggle?: () => void;
  checked: boolean | "indeterminate";
  onCheck: (on: boolean) => void;
  text: string;
  count?: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1 pr-4 hover:bg-subtle" style={{ paddingLeft: 12 + depth * 22 }}>
      {onToggle ? (
        <button onClick={onToggle} aria-expanded={open} className="rounded p-0.5 text-faint hover:text-ink" aria-label={`${open ? "Close" : "Open"} ${text}`}>
          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        </button>
      ) : (
        <span className="w-5" />
      )}
      <Checkbox checked={checked} onCheckedChange={onCheck} aria-label={`Include ${text}`} />
      <span className={cn("min-w-0 flex-1 truncate text-base", strong && "font-medium")} title={text}>
        {text}
      </span>
      {count !== undefined ? <span className="tabular shrink-0 text-xs text-faint">{count}</span> : null}
    </div>
  );
}
