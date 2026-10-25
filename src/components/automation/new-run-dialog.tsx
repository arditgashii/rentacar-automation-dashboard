"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tooltip } from "@/components/ui/tooltip";
import { DAY_SHORT, REPEAT_LABELS, WEEK_ORDER, validateRule } from "@/lib/automation/schedule";
import type { Repeat, RunTarget, SelectionItem, TestSet } from "@/lib/automation/types";
import { api, useResource } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import type { NewRunInit } from "./context";

export type CatalogTree = {
  generatedAt: string;
  error: string | null;
  total: number;
  tree: {
    module: string;
    label: string;
    testCount: number;
    features: {
      module: string;
      feature: string;
      label: string;
      testCount: number;
      files: { file: string; label: string; role: string; testCount: number; costly: boolean }[];
    }[];
  }[];
};

type Preview = { count: number; summary: string; hasSmoke: boolean; hasCostly: boolean; missing: number };
type Channel = { id: string; name: string; webhook: string };

const featureKey = (module: string, feature: string) => `${module}|${feature}`;

/** Splits a saved target back into the three pickers. */
function pickersFrom(target: RunTarget | undefined) {
  const picks = { modules: [] as string[], features: [] as string[], files: [] as string[] };
  if (!target || target.kind !== "tests") return picks;
  for (const item of target.selection) {
    if (item.kind === "module") picks.modules.push(item.module);
    if (item.kind === "feature") {
      picks.modules.push(item.module);
      picks.features.push(featureKey(item.module, item.feature));
    }
    if (item.kind === "file") picks.files.push(item.file);
  }
  return picks;
}

export function NewRunDialog({
  open,
  init,
  busy,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  init: NewRunInit;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const editing = init.schedule;
  const initialTarget = editing?.target ?? init.target;
  const [mode, setMode] = useState<"now" | "schedule">(editing ? "schedule" : (init.mode ?? "now"));
  const [what, setWhat] = useState<"tests" | "suite">(initialTarget?.kind === "suite" ? "suite" : "tests");
  const picks = pickersFrom(initialTarget);
  const [modules, setModules] = useState<string[]>(picks.modules);
  const [features, setFeatures] = useState<string[]>(picks.features);
  const [files, setFiles] = useState<string[]>(picks.files);
  const [tests] = useState<SelectionItem[]>(
    initialTarget?.kind === "tests" ? initialTarget.selection.filter((item) => item.kind === "test") : [],
  );
  const [suiteId, setSuiteId] = useState(initialTarget?.kind === "suite" ? initialTarget.suiteId : "");
  const [testSetChosen, setTestSetChosen] = useState<TestSet | null>(editing?.testSet ?? null);
  const testSet: TestSet = testSetChosen ?? (mode === "schedule" ? "smoke" : "full");
  const [includeCostly, setIncludeCostly] = useState(editing?.includeCostly ?? false);
  const [headed, setHeaded] = useState(false);
  const [watch, setWatch] = useState(false);
  const [name, setName] = useState(editing?.name ?? "");
  const [repeat, setRepeat] = useState<Repeat>((editing?.repeat as Repeat) ?? "weekdays");
  const [days, setDays] = useState<number[]>(editing?.days ?? [1, 3, 5]);
  const [time, setTime] = useState(editing?.time ?? "07:00");
  const [channelId, setChannelId] = useState(editing?.teamsChannelId ?? "");
  const [teamsMode, setTeamsMode] = useState<"every" | "failures">(editing?.teamsMode ?? "every");
  const [bugReports, setBugReports] = useState(editing?.teamsBugReports ?? false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalog = useResource<CatalogTree>(open ? "/api/automation/catalog" : null);
  const suites = useResource<{ suites: { id: string; name: string; testCount: number }[] }>(
    open && what === "suite" ? "/api/automation/suites" : null,
  );
  const teams = useResource<{ channels: Channel[] }>(open && mode === "schedule" ? "/api/automation/teams" : null);
  const tree = useMemo(() => catalog.data?.tree ?? [], [catalog.data]);

  const featureOptions = tree
    .filter((m) => modules.includes(m.module))
    .flatMap((m) => m.features.map((f) => ({ value: featureKey(m.module, f.feature), label: modules.length > 1 ? `${m.label} / ${f.label}` : f.label, hint: String(f.testCount) })));
  const fileOptions = tree
    .flatMap((m) => m.features)
    .filter((f) => features.includes(featureKey(f.module, f.feature)))
    .flatMap((f) => f.files.map((file) => ({ value: file.file, label: `${file.label} (${file.role.replace("-", " ")})` })));

  const selection: SelectionItem[] = useMemo(() => {
    if (tests.length && modules.length === 0) return tests;
    if (files.length) return files.map((file) => ({ kind: "file", file }));
    if (features.length)
      return features.map((key) => {
        const [module, feature] = key.split("|");
        return { kind: "feature", module, feature };
      });
    return modules.map((module) => ({ kind: "module", module }));
  }, [tests, modules, features, files]);

  const suiteName = suites.data?.suites.find((s) => s.id === suiteId)?.name ?? "";
  const target: RunTarget | null =
    what === "suite"
      ? suiteId
        ? { kind: "suite", suiteId, suiteName: suiteName || "Suite" }
        : null
      : selection.length
        ? { kind: "tests", selection }
        : null;
  const targetKey = JSON.stringify(target);

  // The summary under the pickers: the same count the worker will run.
  useEffect(() => {
    if (!open || !target) return;
    const timer = window.setTimeout(async () => {
      try {
        setPreview(await api<Preview>("/api/automation/runs/preview", { body: { target, testSet, includeCostly } }));
        setPreviewError(null);
      } catch (err) {
        setPreview(null);
        setPreviewError((err as Error).message);
      }
    }, 250);
    return () => window.clearTimeout(timer);
    // target is rebuilt every render; its JSON is the real dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetKey, testSet, includeCostly]);

  const shownPreview = target ? preview : null;
  const ruleProblem = mode === "schedule" ? validateRule({ repeat, days, time }, new Date()) : null;
  const nameProblem = mode === "schedule" && !name.trim() ? "Give the schedule a name." : null;
  const canSubmit = Boolean(target && shownPreview && shownPreview.count > 0 && !saving && !ruleProblem && !nameProblem);

  async function submit() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === "now") {
        const run = await api<{ id: string; runningNow: boolean; position: number }>("/api/automation/runs", {
          body: { target, testSet, includeCostly, headed, watch },
        });
        toast.success(run.runningNow ? `Added to the queue (position ${run.position}).` : "The run starts in a moment.");
        onOpenChange(false);
        onDone();
        router.push(`/automation-test/runs/${run.id}`);
      } else {
        const body = {
          name: name.trim(),
          target,
          testSet,
          includeCostly,
          repeat,
          days: repeat === "custom" ? days : [],
          time,
          teamsChannelId: channelId || null,
          teamsMode,
          teamsBugReports: bugReports,
        };
        if (editing) await api(`/api/automation/schedules/${editing.id}`, { method: "PUT", body });
        else await api("/api/automation/schedules", { body });
        toast.success(editing ? "Schedule saved." : "Schedule created.");
        onOpenChange(false);
        onDone();
        if (!editing) router.push("/automation-test/schedules");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!channelId) return;
    try {
      await api("/api/automation/teams/test", { body: { channelId } });
      toast.success("Test message sent.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const title = editing ? "Edit schedule" : "New run";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        size="lg"
        footer={
          <>
            {error ? (
              <p className="mr-auto text-sm text-fail" role="alert">
                {error}
              </p>
            ) : null}
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" disabled={!canSubmit} onClick={submit} data-testid="new-run-submit">
              {saving ? "Saving..." : mode === "schedule" ? (editing ? "Save schedule" : "Create schedule") : busy ? "Add to queue" : "Run"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {editing ? null : (
            <Segmented
              label="Mode"
              value={mode}
              onChange={(value) => setMode(value as "now" | "schedule")}
              options={[
                { value: "now", label: "Run now" },
                { value: "schedule", label: "Schedule" },
              ]}
            />
          )}

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted uppercase">What to run</h3>
            <Segmented
              label="What to run"
              value={what}
              onChange={(value) => setWhat(value as "tests" | "suite")}
              options={[
                { value: "tests", label: "Tests" },
                { value: "suite", label: "Suite" },
              ]}
            />
            {what === "tests" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Environment">
                  {(props) => (
                    <Select {...props} value="local" onChange={() => undefined}>
                      <option value="local">Local</option>
                      <option value="docker" disabled>
                        Docker (not wired yet)
                      </option>
                      <option value="ci" disabled>
                        CI (not wired yet)
                      </option>
                    </Select>
                  )}
                </Field>
                <Field label="Modules">
                  {(props) => (
                    <MultiSelect
                      id={props.id}
                      options={tree.map((m) => ({ value: m.module, label: m.label, hint: String(m.testCount) }))}
                      value={modules}
                      emptyLabel={catalog.loading ? "Loading..." : "Choose modules"}
                      onChange={(value) => {
                        setModules(value);
                        setFeatures((current) => current.filter((key) => value.includes(key.split("|")[0])));
                        setFiles([]);
                      }}
                    />
                  )}
                </Field>
                <Field label="Features" hint={modules.length ? undefined : "Choose a module first."}>
                  {(props) => (
                    <MultiSelect
                      id={props.id}
                      options={featureOptions}
                      value={features}
                      disabled={modules.length === 0}
                      onChange={(value) => {
                        setFeatures(value);
                        setFiles([]);
                      }}
                    />
                  )}
                </Field>
                <Field label="Test files" hint={features.length ? undefined : "Choose a feature first."}>
                  {(props) => (
                    <MultiSelect id={props.id} options={fileOptions} value={files} disabled={features.length === 0} onChange={setFiles} />
                  )}
                </Field>
              </div>
            ) : (
              <Field label="Suite">
                {(props) => (
                  <Select {...props} value={suiteId} onChange={(event) => setSuiteId(event.target.value)}>
                    <option value="">{suites.loading ? "Loading..." : "Choose a suite"}</option>
                    {suites.data?.suites.map((suite) => (
                      <option key={suite.id} value={suite.id}>
                        {suite.name} ({suite.testCount})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}

            <Segmented
              label="Test set"
              value={testSet}
              onChange={(value) => setTestSetChosen(value as TestSet)}
              options={[
                { value: "smoke", label: "Smoke" },
                { value: "full", label: "Full" },
              ]}
            />
            {testSet === "smoke" && shownPreview && !shownPreview.hasSmoke ? (
              <p className="text-sm text-flaky">This choice has no smoke tests. Pick Full to run it.</p>
            ) : null}

            <div className="rounded-md border border-line bg-subtle px-3 py-2 text-base" aria-live="polite" data-testid="run-summary">
              {!target
                ? "Choose what to run."
                : previewError
                  ? <span className="text-fail">{previewError}</span>
                  : shownPreview
                    ? shownPreview.count === 0
                      ? "0 tests: nothing matches this choice."
                      : shownPreview.summary
                    : "Counting tests..."}
              {shownPreview?.missing ? (
                <span className="mt-1 block text-sm text-fail">{shownPreview.missing} chosen item(s) no longer exist.</span>
              ) : null}
            </div>

            {shownPreview?.hasCostly ? (
              <div className="flex flex-col gap-2 rounded-md border border-line px-3 py-2.5">
                <CheckRow checked={includeCostly} onChange={setIncludeCostly} label="Include tests that spend LLM credits" />
                {includeCostly ? (
                  <p className="flex items-start gap-2 text-sm text-flaky">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    These tests call the real LLM when the platform has an API key, which costs money.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {mode === "now" ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted uppercase">Options</h3>
              <CheckRow checked={headed} onChange={setHeaded} label="Show the browser window" />
              <CheckRow checked={watch} onChange={setWatch} label="Watch live in the dashboard (one test at a time)" />
            </section>
          ) : (
            <ScheduleFields
              {...{ name, setName, repeat, setRepeat, days, setDays, time, setTime, channelId, setChannelId, teamsMode, setTeamsMode, bugReports, setBugReports }}
              channels={teams.data?.channels ?? []}
              problem={nameProblem ?? ruleProblem}
              onSendTest={sendTest}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleFields(props: {
  name: string;
  setName: (v: string) => void;
  repeat: Repeat;
  setRepeat: (v: Repeat) => void;
  days: number[];
  setDays: (v: number[]) => void;
  time: string;
  setTime: (v: string) => void;
  channelId: string;
  setChannelId: (v: string) => void;
  teamsMode: "every" | "failures";
  setTeamsMode: (v: "every" | "failures") => void;
  bugReports: boolean;
  setBugReports: (v: boolean) => void;
  channels: Channel[];
  problem: string | null;
  onSendTest: () => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-muted uppercase">Schedule</h3>
      <Field label="Name" hint={`${props.name.length}/80`}>
        {(field) => <Input {...field} value={props.name} maxLength={80} onChange={(e) => props.setName(e.target.value)} placeholder="Nightly smoke" />}
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Repeat">
          {(field) => (
            <Select {...field} value={props.repeat} onChange={(e) => props.setRepeat(e.target.value as Repeat)}>
              {Object.entries(REPEAT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Time">
          {(field) => <Input {...field} type="time" value={props.time} onChange={(e) => props.setTime(e.target.value)} />}
        </Field>
      </div>
      {props.repeat === "custom" ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
          {WEEK_ORDER.map((day) => {
            const on = props.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => props.setDays(on ? props.days.filter((d) => d !== day) : [...props.days, day])}
                className={cn(
                  "h-7 w-11 rounded-md border text-sm font-medium",
                  on ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:bg-hover",
                )}
              >
                {DAY_SHORT[day]}
              </button>
            );
          })}
        </div>
      ) : null}
      {props.problem ? (
        <p className="text-sm text-fail" role="alert">
          {props.problem}
        </p>
      ) : null}

      <div className="mt-1 flex flex-col gap-3 rounded-md border border-line p-3">
        <p className="text-sm font-medium">Microsoft Teams</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Channel">
            {(field) => (
              <Select {...field} value={props.channelId} onChange={(e) => props.setChannelId(e.target.value)}>
                <option value="">Off</option>
                {props.channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Post">
            {(field) => (
              <Select {...field} value={props.teamsMode} disabled={!props.channelId} onChange={(e) => props.setTeamsMode(e.target.value as "every" | "failures")}>
                <option value="every">Every run</option>
                <option value="failures">Only failures</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CheckRow checked={props.bugReports} onChange={props.setBugReports} label="Post a bug report for every failed test" disabled={!props.channelId} />
          <Tooltip content="Posts a short test message to the chosen channel">
            <Button size="sm" disabled={!props.channelId} onClick={props.onSendTest}>
              Send test
            </Button>
          </Tooltip>
        </div>
      </div>
    </section>
  );
}

export function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-fit rounded-md border border-line bg-subtle p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const index = options.findIndex((o) => o.value === value);
            const next = options[(index + (event.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
            onChange(next.value);
          }}
          className={cn(
            "h-7 rounded-[5px] px-3 text-sm font-medium",
            value === option.value ? "bg-surface text-ink shadow-[0_1px_2px_rgb(27_27_25/0.08)]" : "text-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function CheckRow({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center gap-2 text-base", disabled ? "text-muted" : "cursor-pointer")}>
      <Checkbox checked={checked} onCheckedChange={onChange} disabled={disabled} />
      {label}
    </label>
  );
}
