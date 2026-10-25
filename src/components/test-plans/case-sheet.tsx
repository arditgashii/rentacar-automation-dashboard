"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, FileText, Maximize2, Minimize2, Paperclip, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Input, Select, Textarea } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreButton } from "@/components/ui/menu";
import { ErrorState, SkeletonRows } from "@/components/ui/states";
import { api, useResource } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/format";
import { AUTOMATION, type Automation, caseCode, type CaseState, type CaseType, childrenOf, LABELS, PRIORITIES, type Priority, STATES, type Step, type TreeNode, TYPES } from "@/lib/test-plans/model";

type Draft = {
  nodeId: string;
  title: string;
  state: CaseState;
  priority: Priority;
  tags: string[];
  description: string;
  preconditions: string;
  steps: Step[];
  type: CaseType;
  automation: Automation;
  automatedTest: string;
};

type Attachment = { id: string; filename: string; mime: string; size: number; createdAt: string };
type LatestResult = { passed: boolean; outcome: string; runId: string | null; runNumber: number; at: string | null } | null;
type Details = {
  case: Draft & { id: string; projectId: string; number: number; createdBy: string | null; updatedBy: string | null; createdAt: string; updatedAt: string };
  attachments: Attachment[];
  latestResult: LatestResult;
};

const MAX_BYTES = 25 * 1024 * 1024;

function emptyDraft(nodeId: string): Draft {
  return { nodeId, title: "", state: "draft", priority: "medium", tags: [], description: "", preconditions: "", steps: [], type: "functional", automation: "not_automated", automatedTest: "" };
}

function pick(c: Details["case"]): Draft {
  const { nodeId, title, state, priority, tags, description, preconditions, steps, type, automation, automatedTest } = c;
  return { nodeId, title, state, priority, tags, description, preconditions, steps, type, automation, automatedTest };
}

/** Suites and folders of a project in tree order, with their path ("Fleet / Cars / Create"). */
function nodeOptions(nodes: TreeNode[], projectId: string) {
  const options: { id: string; label: string }[] = [];
  const walk = (parentId: string | null, prefix: string) => {
    for (const node of childrenOf(nodes, projectId, parentId)) {
      const label = prefix ? `${prefix} / ${node.name}` : node.name;
      options.push({ id: node.id, label });
      walk(node.id, label);
    }
  };
  walk(null, "");
  return options;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * A test case, like an Azure work item: opens from the right, Maximize fills the screen, Esc closes
 * (and asks first when something is not saved). Saving never drops what is typed meanwhile.
 */
export function CaseSheet({
  caseId,
  projectId,
  defaultNodeId,
  nodes,
  canWrite,
  onClose,
  onSaved,
  onOpenCase,
}: {
  caseId: string | null;
  projectId: string;
  defaultNodeId: string;
  nodes: TreeNode[];
  canWrite: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  onOpenCase: (id: string) => void;
}) {
  const [id, setId] = useState(caseId);
  const details = useResource<Details>(id ? `/api/test-plans/cases/${id}` : null);
  const [draft, setDraft] = useState<Draft | null>(caseId ? null : emptyDraft(defaultNodeId));
  const [baseline, setBaseline] = useState(caseId ? "" : JSON.stringify(emptyDraft(defaultNodeId)));
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const confirm = useConfirm();

  // The saved test case is copied into the draft once it arrives.
  if (id && details.data && draft === null) {
    setDraft(pick(details.data.case));
    setBaseline(JSON.stringify(pick(details.data.case)));
  }

  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  const number = details.data?.case.number;
  const options = nodeOptions(nodes, details.data?.case.projectId ?? projectId);

  function close() {
    if (dirty && canWrite) confirm.ask("Discard changes?", "Your changes to this test case are not saved.", "Discard", onClose);
    else onClose();
  }

  async function save() {
    if (!draft || saving || !canWrite) return;
    if (!draft.title.trim()) {
      setTitleError("Give the test case a title.");
      return;
    }
    // What is sent becomes the saved state; typing that happens during the save stays in the draft.
    const sent = draft;
    setSaving(true);
    try {
      let savedId = id;
      if (savedId) {
        await api(`/api/test-plans/cases/${savedId}`, { method: "PUT", body: sent });
      } else {
        savedId = (await api<{ id: string }>("/api/test-plans/cases", { body: sent })).id;
        setId(savedId);
      }
      setBaseline(JSON.stringify(sent));
      toast.success("Test case saved.");
      if (id) details.refresh();
      onSaved(savedId);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    if (!id) return;
    try {
      const copy = await api<{ id: string; number: number }>(`/api/test-plans/cases/${id}/duplicate`, { body: {} });
      toast.success(`Duplicated as ${caseCode(copy.number)}.`);
      onOpenCase(copy.id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });

  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && close()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/20" />
        <RadixDialog.Content
          aria-describedby={undefined}
          // An existing test case opens with focus on the panel, not on its first button; a new one
          // focuses the title (autoFocus below).
          onOpenAutoFocus={(event) => {
            if (!caseId) return;
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            close();
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
            close();
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
              event.preventDefault();
              void save();
            }
          }}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow-pop)] focus:outline-none",
            maximized ? "lg:left-0" : "sm:w-[min(760px,100vw)]",
          )}
          data-testid="case-sheet"
        >
          <div className="flex items-center gap-2 border-b border-line px-5 py-2.5">
            <RadixDialog.Title className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wider text-muted uppercase">
              {number ? (
                <>
                  Test case <span className="font-mono">{caseCode(number)}</span>
                </>
              ) : (
                "New test case"
              )}
            </RadixDialog.Title>
            {dirty && canWrite ? <span className="text-sm text-flaky">Unsaved</span> : null}
            {canWrite ? (
              <Button variant="primary" size="sm" onClick={save} disabled={saving || !dirty} data-testid="case-save" title="Save (Ctrl+S)">
                {saving ? "Saving..." : "Save"}
              </Button>
            ) : null}
            {canWrite && id ? (
              <DropdownMenu>
                <MoreButton label="Test case actions" />
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onSelect={() =>
                      dirty ? confirm.ask("Duplicate without your changes?", "The copy is made from the saved test case. Your unsaved changes stay here.", "Duplicate", duplicate) : duplicate()
                    }
                  >
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    danger
                    onSelect={() =>
                      confirm.ask("Delete this test case?", "It goes to Deleted, where you can restore it. Its ID is never given to another test case.", "Delete", async () => {
                        try {
                          await api(`/api/test-plans/cases/${id}`, { method: "DELETE" });
                          toast.success("Test case moved to Deleted.");
                          onSaved(id);
                          onClose();
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
            ) : null}
            <button
              type="button"
              onClick={() => setMaximized(!maximized)}
              aria-label={maximized ? "Restore size" : "Maximize"}
              className="hidden size-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink sm:inline-flex"
            >
              {maximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button type="button" onClick={close} aria-label="Close" className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink">
              <X className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {details.error && !draft ? (
              <div className="p-5">
                <ErrorState message={details.error} onRetry={details.reload} />
              </div>
            ) : !draft ? (
              <div className="p-5">
                <SkeletonRows rows={6} />
              </div>
            ) : (
              <div className={cn("flex flex-col", maximized && "mx-auto w-full max-w-[1100px]")}>
                <div className="px-5 pt-4 pb-3">
                  <textarea
                    aria-label="Title"
                    rows={1}
                    value={draft.title}
                    readOnly={!canWrite}
                    placeholder="Title"
                    maxLength={300}
                    autoFocus={!caseId}
                    onChange={(e) => {
                      set({ title: e.target.value.replace(/\n/g, " ") });
                      setTitleError(null);
                    }}
                    className="field-sizing-content w-full resize-none rounded-md border border-transparent px-1.5 py-1 -mx-1.5 text-xl leading-7 font-semibold text-ink placeholder:text-faint hover:border-line focus:border-accent focus:outline-none read-only:hover:border-transparent"
                  />
                  {titleError ? (
                    <p role="alert" className="text-sm text-fail">
                      {titleError}
                    </p>
                  ) : null}
                  <LatestResultLine result={details.data?.latestResult ?? null} saved={Boolean(id)} />
                </div>

                <div className="grid grid-cols-1 gap-3 border-y border-line bg-subtle px-5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
                  <BandField label="State">
                    {(fieldId) => (
                      <Select id={fieldId} value={draft.state} disabled={!canWrite} onChange={(e) => set({ state: e.target.value as CaseState })}>
                        {STATES.map((s) => (
                          <option key={s} value={s}>
                            {LABELS[s]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </BandField>
                  <BandField label="Suite">
                    {(fieldId) => (
                      <Select id={fieldId} value={draft.nodeId} disabled={!canWrite} onChange={(e) => set({ nodeId: e.target.value })} title={options.find((o) => o.id === draft.nodeId)?.label}>
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </BandField>
                  <BandField label="Priority">
                    {(fieldId) => (
                      <Select id={fieldId} value={draft.priority} disabled={!canWrite} onChange={(e) => set({ priority: e.target.value as Priority })}>
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {LABELS[p]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </BandField>
                  <BandField label="Tags" className="sm:col-span-3">{(fieldId) => <TagInput id={fieldId} tags={draft.tags} readOnly={!canWrite} onChange={(tags) => set({ tags })} />}</BandField>
                </div>

                <div className="flex flex-col gap-5 px-5 py-4">
                  <Section title="Description">
                    <Textarea aria-label="Description" value={draft.description} readOnly={!canWrite} placeholder={canWrite ? "What this test case checks" : "No description"} onChange={(e) => set({ description: e.target.value })} className="field-sizing-content min-h-16" maxLength={10000} />
                  </Section>
                  <Section title="Preconditions">
                    <Textarea aria-label="Preconditions" value={draft.preconditions} readOnly={!canWrite} placeholder={canWrite ? "What must be true before the first step" : "None"} onChange={(e) => set({ preconditions: e.target.value })} className="field-sizing-content min-h-12" maxLength={5000} />
                  </Section>
                  <Section title={`Steps${draft.steps.length ? ` (${draft.steps.length})` : ""}`}>
                    <StepsEditor steps={draft.steps} readOnly={!canWrite} onChange={(steps) => set({ steps })} />
                  </Section>
                  <Section title="Attachments">
                    {id ? (
                      <Attachments caseId={id} items={details.data?.attachments ?? []} canWrite={canWrite} onChanged={details.refresh} confirm={confirm} />
                    ) : (
                      <p className="text-sm text-muted">Save the test case to add attachments.</p>
                    )}
                  </Section>
                  <details className="group rounded-md border border-line">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">More details</summary>
                    <div className="grid grid-cols-1 gap-3 border-t border-line px-3 py-3 sm:grid-cols-2">
                      <BandField label="Type">
                        {(fieldId) => (
                          <Select id={fieldId} value={draft.type} disabled={!canWrite} onChange={(e) => set({ type: e.target.value as CaseType })}>
                            {TYPES.map((t) => (
                              <option key={t} value={t}>
                                {LABELS[t]}
                              </option>
                            ))}
                          </Select>
                        )}
                      </BandField>
                      <BandField label="Automation">
                        {(fieldId) => (
                          <Select id={fieldId} value={draft.automation} disabled={!canWrite} onChange={(e) => set({ automation: e.target.value as Automation })}>
                            {AUTOMATION.map((a) => (
                              <option key={a} value={a}>
                                {LABELS[a]}
                              </option>
                            ))}
                          </Select>
                        )}
                      </BandField>
                      <BandField label="Automated test" className="sm:col-span-2">
                        {(fieldId) => (
                          <Input id={fieldId} value={draft.automatedTest} readOnly={!canWrite} className="font-mono text-sm" placeholder="tests/fleet/cars/update/test_update.py::test_..." maxLength={400} onChange={(e) => set({ automatedTest: e.target.value })} />
                        )}
                      </BandField>
                      {details.data ? (
                        <p className="text-sm text-muted sm:col-span-2">
                          Created {formatDateTime(details.data.case.createdAt)}
                          {details.data.case.createdBy ? ` by ${details.data.case.createdBy}` : ""}. Updated {formatDateTime(details.data.case.updatedAt)}
                          {details.data.case.updatedBy ? ` by ${details.data.case.updatedBy}` : ""}.
                        </p>
                      ) : null}
                    </div>
                  </details>
                </div>
              </div>
            )}
          </div>
          {confirm.dialog}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function LatestResultLine({ result, saved }: { result: LatestResult; saved: boolean }) {
  if (!saved) return null;
  if (!result) return <p className="mt-1 text-sm text-muted">Latest result: Not run yet</p>;
  const label = result.passed ? "Passed" : result.outcome === "known_bug" ? "Failed, known bug" : "Failed";
  const body = (
    <>
      <Badge tone={result.passed ? "pass" : result.outcome === "known_bug" ? "known" : "fail"}>{label}</Badge>
      <span>
        in run <span className="font-mono">#{result.runNumber}</span>
        {result.at ? `, ${formatRelative(result.at)}` : ""}
      </span>
    </>
  );
  return (
    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
      Latest result:
      {result.runId ? (
        <Link href={`/automation-test/runs/${result.runId}`} className="inline-flex items-center gap-2 hover:text-ink hover:underline">
          {body}
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2">{body}</span>
      )}
    </p>
  );
}

function BandField({ label, className, children }: { label: string; className?: string; children: (id: string) => React.ReactNode }) {
  const id = `f-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function TagInput({ id, tags, readOnly, onChange }: { id: string; tags: string[]; readOnly: boolean; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState("");
  const add = (value: string) => {
    const tag = value.trim().replace(/,/g, "").slice(0, 40);
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase()) && tags.length < 20) onChange([...tags, tag]);
    setText("");
  };
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-1 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex max-w-full items-center gap-0.5 rounded bg-hover px-1.5 text-sm">
          <span className="truncate">{tag}</span>
          {readOnly ? null : (
            <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => onChange(tags.filter((t) => t !== tag))} className="rounded text-muted hover:text-ink">
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {readOnly ? (
        tags.length ? null : <span className="px-1 text-sm text-faint">None</span>
      ) : (
        <input
          id={id}
          value={text}
          placeholder={tags.length ? "" : "Add a tag"}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
          className="h-6 min-w-16 flex-1 bg-transparent px-1 text-base focus:outline-none"
        />
      )}
    </div>
  );
}

function StepsEditor({ steps, readOnly, onChange }: { steps: Step[]; readOnly: boolean; onChange: (steps: Step[]) => void }) {
  const list = useRef<HTMLOListElement>(null);
  const update = (index: number, patch: Partial<Step>) => onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const move = (index: number, by: number) => {
    const next = [...steps];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="hidden grid-cols-[32px_minmax(0,1fr)_minmax(0,1fr)_84px] border-b border-line bg-subtle px-2 py-1.5 text-xs font-medium text-muted sm:grid">
        <span>#</span>
        <span>Action</span>
        <span>Expected result</span>
        <span />
      </div>
      <ol ref={list}>
        {steps.map((step, index) => (
          <li key={index} className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-2 gap-y-1.5 border-b border-line px-2 py-2 last:border-b-0 sm:grid-cols-[32px_minmax(0,1fr)_minmax(0,1fr)_84px]" data-testid="step-row">
            <span className="tabular pt-1.5 text-sm text-muted">{index + 1}</span>
            <Textarea aria-label={`Step ${index + 1} action`} value={step.action} readOnly={readOnly} rows={1} placeholder="Action" className="field-sizing-content min-h-8" onChange={(e) => update(index, { action: e.target.value })} />
            <Textarea aria-label={`Step ${index + 1} expected result`} value={step.expected} readOnly={readOnly} rows={1} placeholder="Expected result" className="col-start-2 field-sizing-content min-h-8 sm:col-start-auto" onChange={(e) => update(index, { expected: e.target.value })} />
            {readOnly ? (
              <span className="hidden sm:block" />
            ) : (
              <div className="col-start-2 flex items-start gap-0.5 sm:col-start-auto">
                <IconButton label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp className="size-3.5" />
                </IconButton>
                <IconButton label={`Move step ${index + 1} down`} disabled={index === steps.length - 1} onClick={() => move(index, 1)}>
                  <ArrowDown className="size-3.5" />
                </IconButton>
                <IconButton label={`Delete step ${index + 1}`} onClick={() => onChange(steps.filter((_, i) => i !== index))}>
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ol>
      {readOnly ? (
        steps.length ? null : <p className="px-3 py-2.5 text-sm text-muted">No steps.</p>
      ) : (
        <button
          type="button"
          onClick={() => {
            onChange([...steps, { action: "", expected: "" }]);
            requestAnimationFrame(() => list.current?.querySelector<HTMLTextAreaElement>("li:last-child textarea")?.focus());
          }}
          className={cn("w-full px-3 py-2.5 text-left text-sm text-muted hover:bg-hover hover:text-ink", steps.length && "border-t border-line")}
        >
          Click here to add a step
        </button>
      )}
    </div>
  );
}

function IconButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent" {...props}>
      {children}
    </button>
  );
}

function Attachments({
  caseId,
  items,
  canWrite,
  onChanged,
  confirm,
}: {
  caseId: string;
  items: Attachment[];
  canWrite: boolean;
  onChanged: () => void;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const tooBig = [...files].find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast.error(`${tooBig.name} is larger than 25 MB.`);
      return;
    }
    const form = new FormData();
    for (const file of files) form.append("files", file);
    setUploading(true);
    try {
      const response = await fetch(`/api/test-plans/cases/${caseId}/attachments`, { method: "POST", body: form });
      const data = (await response.json().catch(() => ({}))) as { error?: string; added?: unknown[] };
      if (!response.ok) throw new Error(data.error ?? "The upload failed.");
      toast.success(files.length === 1 ? "File added." : `${files.length} files added.`);
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((a) => (
            <li key={a.id} className="flex min-w-0 items-center gap-2.5 rounded-md border border-line p-2" data-testid="attachment">
              <a href={`/api/test-plans/attachments/${a.id}`} target="_blank" rel="noreferrer" className="shrink-0">
                {a.mime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/test-plans/attachments/${a.id}`} alt={a.filename} className="size-12 rounded border border-line object-cover" />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded border border-line bg-subtle text-muted">
                    <FileText className="size-5" />
                  </span>
                )}
              </a>
              <div className="min-w-0 flex-1">
                <a href={`/api/test-plans/attachments/${a.id}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline" title={a.filename}>
                  {a.filename}
                </a>
                <p className="text-xs text-muted">{formatSize(a.size)}</p>
              </div>
              {canWrite ? (
                <IconButton
                  label={`Remove ${a.filename}`}
                  onClick={() =>
                    confirm.ask("Remove this file?", <>{a.filename} will be deleted. This cannot be undone.</>, "Remove", async () => {
                      try {
                        await api(`/api/test-plans/attachments/${a.id}`, { method: "DELETE" });
                        toast.success("File removed.");
                        onChanged();
                      } catch (error) {
                        toast.error((error as Error).message);
                      }
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No attachments.</p>
      )}
      {canWrite ? (
        <div>
          <input ref={input} type="file" multiple className="sr-only" aria-hidden onChange={(e) => upload(e.target.files)} tabIndex={-1} />
          <Button size="sm" onClick={() => input.current?.click()} disabled={uploading}>
            <Paperclip className="size-3.5" aria-hidden /> {uploading ? "Uploading..." : "Add files"}
          </Button>
          <span className="ml-2 text-xs text-muted">Up to 25 MB each</span>
        </div>
      ) : null}
    </div>
  );
}
