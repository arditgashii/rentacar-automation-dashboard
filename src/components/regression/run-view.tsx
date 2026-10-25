"use client";

import { ChevronRight, History, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NameDialog } from "@/components/test-plans/name-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreButton } from "@/components/ui/menu";
import { ErrorState, SkeletonRows } from "@/components/ui/states";
import { api, useResource } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDay, formatRelative, plural } from "@/lib/format";
import {
  childrenOf,
  type Counts,
  countResults,
  type Filter,
  functionsBelow,
  groupTone,
  type Item,
  jiraHref,
  jiraLabel,
  KIND_LABELS,
  linkify,
  parseJira,
  RESULT_LABELS,
  type Result,
  SPRINT_KINDS,
  visible,
} from "@/lib/regression/model";

type Run = {
  id: string;
  kind: string;
  team: string;
  name: string;
  status: "open" | "completed";
  startedBy: string | null;
  startedAt: string;
  completedBy: string | null;
  completedAt: string | null;
};
type RunData = { run: Run; items: Item[]; canWrite: boolean; jiraBaseUrl: string };
type RunSummary = { id: string; name: string; status: "open" | "completed"; startedAt: string; counts: Counts };

const RESULT_TONE: Record<Result, "pass" | "fail" | "flaky" | "neutral"> = { passed: "pass", failed: "fail", blocked: "flaky", not_tested: "neutral" };
const TONE_TEXT = { pass: "text-pass", fail: "text-fail", flaky: "text-flaky", skip: "text-muted" } as const;
const FILTERS: Filter[] = ["all", "not_tested", "failed", "blocked", "passed"];

export function ProgressBar({ counts, className }: { counts: Counts; className?: string }) {
  const part = (n: number) => `${counts.total ? (n / counts.total) * 100 : 0}%`;
  const tested = counts.total - counts.not_tested;
  return (
    <div
      role="img"
      aria-label={`${tested} of ${counts.total} tested: ${counts.passed} passed, ${counts.failed} failed, ${counts.blocked} blocked`}
      className={cn("flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-line", className)}
    >
      {counts.passed ? <span className="bg-pass" style={{ width: part(counts.passed) }} /> : null}
      {counts.failed ? <span className="bg-fail" style={{ width: part(counts.failed) }} /> : null}
      {counts.blocked ? <span className="bg-flaky" style={{ width: part(counts.blocked) }} /> : null}
    </div>
  );
}

export function RunView({
  runId,
  sprint,
  runs,
  onChanged,
  onOpenRun,
}: {
  runId: string;
  sprint: boolean;
  runs: RunSummary[];
  onChanged: () => void;
  onOpenRun: (name: string) => void;
}) {
  const data = useResource<RunData>(`/api/regression/runs/${runId}`);
  // Results change on the page at once; the server answer confirms them or rolls them back.
  const [local, setLocal] = useState<{ source: RunData | null; items: Item[] }>({ source: null, items: [] });
  if (data.data && data.data !== local.source) setLocal({ source: data.data, items: data.data.items });
  const items = local.items;
  const setItems = (update: (items: Item[]) => Item[]) => setLocal((current) => ({ ...current, items: update(current.items) }));

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [naming, setNaming] = useState<{ title: string; initial: string; submit: (name: string) => Promise<void> } | null>(null);
  const [historyOf, setHistoryOf] = useState<Item | null>(null);
  const [sprintEdit, setSprintEdit] = useState<Item | "new" | null>(null);
  const [runHistory, setRunHistory] = useState(false);
  const confirm = useConfirm();

  if (data.error && !data.data) return <ErrorState message={data.error} onRetry={data.reload} />;
  if (!data.data) return <SkeletonRows rows={8} />;

  const { run, jiraBaseUrl } = data.data;
  const readOnly = !data.data.canWrite || run.status === "completed";
  const counts = countResults(items);
  const filtering = filter !== "all" || query.trim() !== "";

  async function patch(item: Item, change: Partial<Pick<Item, "result" | "comment" | "name" | "jira">> & { kind?: Item["kind"] }) {
    const before = item;
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, ...change } : i)));
    try {
      const saved = await api<{ updatedAt: string | null; updatedBy: string | null }>(`/api/regression/items/${item.id}`, { method: "PATCH", body: change });
      if (saved.updatedBy) setItems((all) => all.map((i) => (i.id === item.id ? { ...i, updatedBy: saved.updatedBy, updatedAt: saved.updatedAt } : i)));
      onChanged();
      return true;
    } catch (error) {
      setItems((all) => all.map((i) => (i.id === item.id ? before : i)));
      toast.error((error as Error).message);
      return false;
    }
  }

  // A second click on the chosen result goes back to Not tested.
  const setResult = (item: Item, result: Result) => patch(item, { result: item.result === result ? "not_tested" : result });

  async function add(body: { kind: Item["kind"]; parentId: string | null; name: string; jira?: string; alsoLibrary?: boolean }) {
    await api(`/api/regression/runs/${runId}/items`, { body: { jira: "", alsoLibrary: false, ...body } });
    await data.refresh();
    onChanged();
  }

  function rename(item: Item) {
    setNaming({
      title: `Rename ${KIND_LABELS[item.kind].toLowerCase()}`,
      initial: item.name,
      submit: async (name) => {
        const done = await patch(item, { name });
        if (!done) throw new Error("The name was not saved.");
        if (item.libraryId && !item.removedFromLibrary) toast.success("Renamed here and in the library.");
      },
    });
  }

  function removeFromLibrary(item: Item) {
    const below = item.kind === "function" ? "" : ` and the ${plural(functionsBelow(items, item.id).length, "function")} in it`;
    confirm.ask(
      "Remove from library?",
      <>
        New runs will not have {item.name}
        {below}. This run keeps {item.kind === "function" ? "it and its result" : "them and their results"}.
      </>,
      "Remove from library",
      async () => {
        try {
          await api(`/api/regression/items/${item.id}/remove-from-library`, { body: {} });
          toast.success("Removed from the library.");
          await data.refresh();
        } catch (error) {
          toast.error((error as Error).message);
        }
      },
    );
  }

  async function setStatus(status: "open" | "completed") {
    try {
      await api(`/api/regression/runs/${runId}`, { method: "PATCH", body: { status } });
      toast.success(status === "completed" ? "Run completed." : "Run reopened.");
      await data.refresh();
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function complete() {
    const missing = counts.not_tested;
    confirm.ask(
      "Complete this run?",
      missing ? `${plural(missing, "item is", "items are")} still Not tested. After completing, the run is read only until someone reopens it.` : "After completing, the run is read only until someone reopens it.",
      "Complete run",
      () => setStatus("completed"),
    );
  }

  const itemMenu = (item: Item) =>
    readOnly ? null : (
      <DropdownMenu>
        <MoreButton label={`Actions for ${item.name}`} />
        <DropdownMenuContent>
          {sprint ? (
            <>
              <DropdownMenuItem onSelect={() => setSprintEdit(item)}>Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                danger
                onSelect={() =>
                  confirm.ask("Remove this item?", <>{item.name} and its result will be removed from this sprint.</>, "Remove", async () => {
                    try {
                      await api(`/api/regression/items/${item.id}`, { method: "DELETE" });
                      toast.success("Item removed.");
                      await data.refresh();
                      onChanged();
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  })
                }
              >
                Remove
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => rename(item)}>Rename</DropdownMenuItem>
              <DropdownMenuItem disabled={!item.libraryId || item.removedFromLibrary} onSelect={() => removeFromLibrary(item)}>
                Remove from library
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  const row = (item: Item) => (
    <ItemRow
      key={item.id}
      item={item}
      readOnly={readOnly}
      jiraBaseUrl={jiraBaseUrl}
      onResult={(r) => setResult(item, r)}
      onComment={(comment) => patch(item, { comment })}
      onHistory={() => setHistoryOf(item)}
      menu={itemMenu(item)}
    />
  );

  const modules = childrenOf(items, null);
  const tested = counts.total - counts.not_tested;

  return (
    <div className="flex flex-col gap-4">
      <div className="z-20 -mx-4 md:sticky md:top-0 flex flex-col gap-3 border-b border-line bg-bg px-4 pt-1 pb-3 sm:-mx-6 sm:px-6" data-testid="run-bar">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="min-w-0 truncate text-lg font-semibold" title={run.name}>
            {run.name}
          </h2>
          {run.status === "completed" ? <Badge tone="neutral">Completed</Badge> : <Badge tone="run">In progress</Badge>}
          <p className="text-sm text-muted">
            Started{run.startedBy ? ` by ${run.startedBy}` : ""} at {formatDateTime(run.startedAt)}
            {run.completedAt ? `. Completed${run.completedBy ? ` by ${run.completedBy}` : ""} at ${formatDateTime(run.completedAt)}` : ""}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={() => setRunHistory(true)}>
              <History className="size-3.5" aria-hidden /> Run history
            </Button>
            {data.data.canWrite ? (
              run.status === "completed" ? (
                <Button size="sm" onClick={() => setStatus("open")}>
                  Reopen
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={complete} data-testid="complete-run">
                  Complete run
                </Button>
              )
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <ProgressBar counts={counts} className="max-w-[420px] min-w-40 flex-1" />
          <p className="tabular text-sm text-muted" data-testid="run-counts">
            <span className="font-medium text-ink">
              {tested} of {counts.total}
            </span>{" "}
            tested: <span className="text-pass">{counts.passed} passed</span>, <span className="text-fail">{counts.failed} failed</span>, <span className="text-flaky">{counts.blocked} blocked</span>,{" "}
            {counts.not_tested} not tested
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm font-medium",
                  filter === f ? "bg-ink text-white" : "text-muted hover:bg-hover hover:text-ink",
                )}
              >
                {f === "all" ? "All" : RESULT_LABELS[f]}
                <span className={cn("tabular text-xs", filter === f ? "text-white/70" : "text-faint")}>{f === "all" ? counts.total : counts[f]}</span>
              </button>
            ))}
          </div>
          <div className="relative ml-auto min-w-0 flex-[0_1_260px]">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
            <Input aria-label="Search items" className="pl-8" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {run.status === "completed" ? (
        <p role="status" className="rounded-md border border-line bg-subtle px-3 py-2 text-sm text-muted">
          This run is completed and read only.{data.data.canWrite ? " Reopen it to change results." : ""}
        </p>
      ) : null}

      {sprint ? (
        <SprintList items={items} filter={filter} query={query} row={row} readOnly={readOnly} onAdd={() => setSprintEdit("new")} />
      ) : (
        <div className="flex flex-col gap-3">
          {!filtering && modules.length > 1 ? (
            <div className="flex justify-end gap-3 text-sm">
              <button type="button" className="text-muted hover:text-ink" onClick={() => setOpen(new Set(modules.map((m) => m.id)))}>
                Open all
              </button>
              <button type="button" className="text-muted hover:text-ink" onClick={() => setOpen(new Set())}>
                Close all
              </button>
            </div>
          ) : null}
          {modules.map((module) => {
            const moduleCounts = countResults(functionsBelow(items, module.id));
            const features = childrenOf(items, module.id);
            const shown = features.map((feature) => ({ feature, functions: childrenOf(items, feature.id).filter((f) => visible(f, items, filter, query)) }));
            if (filtering && !shown.some((s) => s.functions.length)) return null;
            const isOpen = filtering || open.has(module.id);
            const tone = groupTone(moduleCounts);
            return (
              <section key={module.id} className="overflow-hidden rounded-lg border border-line bg-surface" data-testid="module-card">
                <div className="flex items-center gap-2 pr-2">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    disabled={filtering}
                    onClick={() => {
                      const next = new Set(open);
                      if (next.has(module.id)) next.delete(module.id);
                      else next.add(module.id);
                      setOpen(next);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left"
                  >
                    <ChevronRight className={cn("size-4 shrink-0 text-muted transition-transform", isOpen && "rotate-90")} aria-hidden />
                    <span className="truncate font-semibold">{module.name}</span>
                    {module.removedFromLibrary ? <Badge tone="neutral">Removed from library</Badge> : null}
                    <span className="ml-auto hidden w-28 sm:block">
                      <ProgressBar counts={moduleCounts} />
                    </span>
                    <span className={cn("tabular ml-auto w-14 shrink-0 text-right text-sm font-medium sm:ml-0", TONE_TEXT[tone])}>
                      {moduleCounts.passed}/{moduleCounts.total}
                    </span>
                  </button>
                  {itemMenu(module)}
                </div>
                {isOpen ? (
                  <div className="border-t border-line">
                    {shown.map(({ feature, functions }) => {
                      if (filtering && !functions.length) return null;
                      const featureCounts = countResults(childrenOf(items, feature.id));
                      return (
                        <div key={feature.id} data-testid="feature">
                          <div className="flex items-center gap-2 border-b border-line bg-subtle py-1.5 pr-2 pl-10">
                            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{feature.name}</h3>
                            {feature.removedFromLibrary ? <Badge tone="neutral">Removed from library</Badge> : null}
                            <span className={cn("tabular text-sm", TONE_TEXT[groupTone(featureCounts)])}>
                              {featureCounts.passed}/{featureCounts.total}
                            </span>
                            {itemMenu(feature)}
                          </div>
                          <ul>{functions.map(row)}</ul>
                          {!readOnly && !filtering ? (
                            <AddInline label="Add function" indent canLibrary={Boolean(feature.libraryId && !feature.removedFromLibrary)} onSubmit={(name, also) => add({ kind: "function", parentId: feature.id, name, alsoLibrary: also })} />
                          ) : null}
                        </div>
                      );
                    })}
                    {!readOnly && !filtering ? (
                      <AddInline label="Add feature" canLibrary={Boolean(module.libraryId && !module.removedFromLibrary)} onSubmit={(name, also) => add({ kind: "feature", parentId: module.id, name, alsoLibrary: also })} />
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
          {filtering && !items.some((i) => i.kind === "function" && visible(i, items, filter, query)) ? (
            <p className="py-6 text-center text-base text-muted">Nothing matches.</p>
          ) : null}
          {!readOnly && !filtering ? (
            <div className="rounded-lg border border-dashed border-line-strong bg-surface">
              <AddInline label="Add module" canLibrary onSubmit={(name, also) => add({ kind: "module", parentId: null, name, alsoLibrary: also })} />
            </div>
          ) : null}
        </div>
      )}

      {naming ? <NameDialog title={naming.title} label="Name" initial={naming.initial} action="Rename" submit={naming.submit} onClose={() => setNaming(null)} /> : null}
      {historyOf ? <HistoryDialog item={historyOf} onClose={() => setHistoryOf(null)} /> : null}
      {sprintEdit ? (
        <SprintItemDialog
          item={sprintEdit === "new" ? null : sprintEdit}
          onClose={() => setSprintEdit(null)}
          onSave={async (body) => {
            if (sprintEdit === "new") await add({ ...body, parentId: null });
            else {
              await api(`/api/regression/items/${sprintEdit.id}`, { method: "PATCH", body });
              await data.refresh();
            }
          }}
        />
      ) : null}
      {runHistory ? (
        <Dialog open onOpenChange={(o) => !o && setRunHistory(false)}>
          <DialogContent title="Run history" description={`Every ${sprint ? "sprint" : "release"} of ${run.team}, newest first.`}>
            <ul className="-my-2">
              {runs.map((r) => (
                <li key={r.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRunHistory(false);
                      onOpenRun(r.name);
                    }}
                    className={cn("flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left hover:bg-subtle", r.id === run.id && "font-medium")}
                  >
                    <span className="min-w-0 flex-[1_1_140px] truncate">{r.name}</span>
                    {r.status === "completed" ? <Badge tone="neutral">Completed</Badge> : <Badge tone="run">In progress</Badge>}
                    <span className="w-28">
                      <ProgressBar counts={r.counts} />
                    </span>
                    <span className="tabular text-sm text-faint">{formatDay(r.startedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      ) : null}
      {confirm.dialog}
    </div>
  );
}

function SprintList({ items, filter, query, row, readOnly, onAdd }: { items: Item[]; filter: Filter; query: string; row: (item: Item) => React.ReactNode; readOnly: boolean; onAdd: () => void }) {
  const all = childrenOf(items, null);
  const shown = all.filter((i) => visible(i, items, filter, query));
  return (
    <div className="flex flex-col gap-3">
      {!readOnly ? (
        <div>
          <Button onClick={onAdd} data-testid="add-sprint-item">
            <Plus className="size-4" aria-hidden /> Add item
          </Button>
        </div>
      ) : null}
      {!all.length ? (
        <p className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-base text-muted">
          A sprint run starts empty. {readOnly ? "" : "Add the stories, tasks and bugs of the sprint."}
        </p>
      ) : !shown.length ? (
        <p className="py-6 text-center text-base text-muted">Nothing matches.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-line bg-surface">{shown.map(row)}</ul>
      )}
    </div>
  );
}

function ItemRow({
  item,
  readOnly,
  jiraBaseUrl,
  onResult,
  onComment,
  onHistory,
  menu,
}: {
  item: Item;
  readOnly: boolean;
  jiraBaseUrl: string;
  onResult: (result: Result) => void;
  onComment: (comment: string) => Promise<boolean>;
  onHistory: () => void;
  menu: React.ReactNode;
}) {
  const sprintItem = item.kind === "story" || item.kind === "task" || item.kind === "bug";
  return (
    <li className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 border-b border-line px-4 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_auto]", item.kind === "function" && "md:pl-10")} data-testid="item-row">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base">
          {sprintItem ? <Badge tone={item.kind === "bug" ? "fail" : item.kind === "story" ? "accent" : "neutral"}>{KIND_LABELS[item.kind]}</Badge> : null}
          <span className="min-w-0 break-words">{item.name}</span>
          {item.jira ? (
            <a href={jiraHref(item.jira, jiraBaseUrl)} target="_blank" rel="noreferrer" className="font-mono text-sm text-accent hover:underline">
              {jiraLabel(item.jira)}
            </a>
          ) : null}
          {item.removedFromLibrary && item.kind === "function" ? <Badge tone="neutral">Removed from library</Badge> : null}
        </p>
        <button type="button" onClick={onHistory} className="mt-0.5 inline-flex items-center gap-1 text-xs text-faint hover:text-ink" aria-label={`History of ${item.name}`}>
          <History className="size-3" aria-hidden />
          {item.updatedAt && item.updatedBy ? (
            <span title={formatDateTime(item.updatedAt)}>
              {item.updatedBy}, {formatRelative(item.updatedAt)}
            </span>
          ) : (
            "No changes yet"
          )}
        </button>
      </div>
      <div className="col-start-1 row-start-2 md:col-start-auto md:row-start-auto">
        {readOnly ? (
          <Badge tone={RESULT_TONE[item.result]}>{RESULT_LABELS[item.result]}</Badge>
        ) : (
          <div role="group" aria-label={`Result of ${item.name}`} className="inline-flex rounded-md border border-line bg-subtle p-0.5">
            {(["passed", "failed", "blocked"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={item.result === r}
                onClick={() => onResult(r)}
                className={cn(
                  "h-7 rounded-[5px] px-2.5 text-sm font-medium",
                  item.result === r
                    ? { passed: "bg-pass-soft text-pass", failed: "bg-fail-soft text-fail", blocked: "bg-flaky-soft text-flaky" }[r]
                    : "text-muted hover:bg-surface hover:text-ink",
                )}
              >
                {RESULT_LABELS[r]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="col-span-2 min-w-0 md:col-span-1">
        <CommentField value={item.comment} readOnly={readOnly} jiraBaseUrl={jiraBaseUrl} label={`Comment on ${item.name}`} onSave={onComment} />
      </div>
      <div className="col-start-2 row-start-1 flex justify-end md:col-start-auto md:row-start-auto">{menu}</div>
    </li>
  );
}

/** Saved on blur or Enter, Esc cancels. Outside editing, URLs and Jira keys are links. */
function CommentField({ value, readOnly, jiraBaseUrl, label, onSave }: { value: string; readOnly: boolean; jiraBaseUrl: string; label: string; onSave: (comment: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  async function save() {
    setEditing(false);
    const next = text.trim();
    if (next !== value) {
      const ok = await onSave(next);
      if (!ok) setText(value);
    }
  }

  if (editing) {
    return (
      <Input
        aria-label={label}
        autoFocus
        value={text}
        maxLength={2000}
        placeholder="Comment"
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setText(value);
            setEditing(false);
          }
        }}
      />
    );
  }
  if (!value) {
    return readOnly ? null : (
      <button
        type="button"
        onClick={() => {
          setText("");
          setEditing(true);
        }}
        className="h-8 w-full rounded-md border border-dashed border-transparent px-2.5 text-left text-sm text-faint hover:border-line hover:text-muted"
        aria-label={label}
      >
        Add a comment
      </button>
    );
  }
  return (
    <div className="group flex min-w-0 items-start gap-1 py-1.5 text-sm" data-testid="comment">
      <p className="min-w-0 flex-1 break-words text-ink">
        {linkify(value, jiraBaseUrl).map((part, i) =>
          part.href ? (
            <a key={i} href={part.href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              {part.text}
            </a>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </p>
      {readOnly ? null : (
        <button
          type="button"
          onClick={() => {
            setText(value);
            setEditing(true);
          }}
          className="shrink-0 rounded px-1 text-xs text-muted hover:bg-hover hover:text-ink"
          aria-label={`Edit ${label.toLowerCase()}`}
        >
          Edit
        </button>
      )}
    </div>
  );
}

/** "Add function" and friends: Enter saves, Esc cancels. */
function AddInline({ label, indent, canLibrary, onSubmit }: { label: string; indent?: boolean; canLibrary: boolean; onSubmit: (name: string, alsoLibrary: boolean) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [also, setAlso] = useState(true);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit(name.trim(), canLibrary && also);
      setName("");
      toast.success(`${label.replace("Add ", "")[0].toUpperCase()}${label.replace("Add ", "").slice(1)} added${canLibrary && also ? " here and to future runs" : ""}.`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn("flex w-full items-center gap-1.5 px-4 py-2 text-left text-sm text-muted hover:bg-subtle hover:text-ink", indent && "md:pl-10")}>
        <Plus className="size-3.5" aria-hidden /> {label}
      </button>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-t border-line px-4 py-2", indent && "md:pl-10")}>
      <Input
        aria-label={label}
        autoFocus
        className="min-w-0 flex-[1_1_220px]"
        placeholder="Name"
        maxLength={200}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setName("");
          }
        }}
      />
      {canLibrary ? (
        <label className="flex items-center gap-2 text-sm text-muted">
          <Checkbox checked={also} onCheckedChange={setAlso} /> Also add to future runs
        </label>
      ) : null}
      <Button size="sm" variant="primary" onClick={save} disabled={busy || !name.trim()}>
        Add
      </Button>
      <Button
        size="sm"
        onClick={() => {
          setOpen(false);
          setName("");
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

type HistoryLine = { id: number; field: "result" | "comment" | "name" | "jira"; oldValue: string; newValue: string; by: string; at: string };

function HistoryDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const history = useResource<{ history: HistoryLine[] }>(`/api/regression/items/${item.id}/history`);
  const describe = (line: HistoryLine) => {
    const value = (v: string) => (line.field === "result" ? RESULT_LABELS[v as Result] ?? v : v ? `"${v}"` : "empty");
    const what = { result: "the result", comment: "the comment", name: "the name", jira: "the Jira link" }[line.field];
    return `changed ${what} from ${value(line.oldValue)} to ${value(line.newValue)}`;
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="History" description={item.name}>
        {history.loading && !history.data ? (
          <SkeletonRows rows={3} />
        ) : history.error ? (
          <ErrorState message={history.error} onRetry={history.reload} />
        ) : !history.data?.history.length ? (
          <p className="py-4 text-center text-base text-muted">No changes yet.</p>
        ) : (
          <ol className="flex flex-col gap-3" data-testid="history">
            {history.data.history.map((line) => (
              <li key={line.id} className="text-sm">
                <p className="break-words text-ink">
                  <span className="font-medium">{line.by}</span> {describe(line)}
                </p>
                <p className="text-xs text-muted" title={formatDateTime(line.at)}>
                  {formatRelative(line.at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SprintItemDialog({ item, onClose, onSave }: { item: Item | null; onClose: () => void; onSave: (body: { kind: "story" | "task" | "bug"; name: string; jira: string }) => Promise<void> }) {
  const [kind, setKind] = useState<"story" | "task" | "bug">((item?.kind as "story") ?? "story");
  const [name, setName] = useState(item?.name ?? "");
  const [jira, setJira] = useState(item?.jira ?? "");
  const [errors, setErrors] = useState<{ name?: string; jira?: string }>({});
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Give the item a title.";
    if (!parseJira(jira)) next.jira = "Use a Jira key like DN-1234 or a full Jira link.";
    setErrors(next);
    if (next.name || next.jira) return;
    setBusy(true);
    try {
      await onSave({ kind, name: name.trim(), jira: jira.trim() });
      toast.success(item ? "Item saved." : "Item added.");
      onClose();
    } catch (error) {
      const message = (error as Error).message;
      setErrors(/jira/i.test(message) ? { jira: message } : { name: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={item ? "Edit item" : "Add item"}
        size="sm"
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form="sprint-item-form" disabled={busy}>
              {item ? "Save" : "Add item"}
            </Button>
          </>
        }
      >
        <form id="sprint-item-form" onSubmit={save} className="flex flex-col gap-4" noValidate>
          <Field label="Type">
            {(props) => (
              <Select {...props} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                {SPRINT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Title" error={errors.name}>
            {(props) => <Input {...props} autoFocus value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Jira link" error={errors.jira} hint="A key like DN-1234 or a full Jira link.">
            {(props) => <Input {...props} value={jira} maxLength={300} placeholder="DN-1234" className="font-mono" onChange={(e) => setJira(e.target.value)} />}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
