"use client";

import { Eye, EyeOff, Plus, RotateCcw, Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreButton } from "@/components/ui/menu";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { PLACEHOLDERS, renderTemplate, SAMPLE_VALUES, type TemplateKind, validateTemplate } from "@/lib/automation/teams";
import { api, useResource } from "@/lib/client/api";
import { useLeaveGuard } from "@/lib/client/leave-guard";
import { cn } from "@/lib/cn";
import { Segmented } from "./new-run-dialog";

type Channel = { id: string; name: string; webhook: string; usedBy: string[] };
type Settings = {
  twoChannels: boolean;
  resultsChannelId: string | null;
  bugsChannelId: string | null;
  resultsTemplate: string;
  bugTemplate: string;
  morningEnabled: boolean;
  morningChannelId: string | null;
};
type TeamsData = { channels: Channel[]; settings: Settings; defaults: Record<TemplateKind, string> };

const TEMPLATE_FIELD: Record<TemplateKind, "resultsTemplate" | "bugTemplate"> = { results: "resultsTemplate", bug: "bugTemplate" };

export function SettingsView() {
  const data = useResource<TeamsData>("/api/automation/teams");
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  // The settings are copied into the draft once they arrive.
  if (data.data && draft === null) {
    setDraft(data.data.settings);
    setSaved(JSON.stringify(data.data.settings));
  }

  const dirty = draft !== null && JSON.stringify(draft) !== saved;
  const discard = useCallback(() => setDraft(JSON.parse(saved) as Settings), [saved]);
  useLeaveGuard(dirty, confirm, "Your changes to the Teams settings will be lost.", discard);

  if (data.error) return <ErrorState message={data.error} onRetry={data.reload} />;
  if (!data.data || !draft) return <SkeletonRows rows={6} />;

  const { channels, defaults } = data.data;
  const problems = [...validateTemplate("results", draft.resultsTemplate), ...validateTemplate("bug", draft.bugTemplate)];
  const set = (patch: Partial<Settings>) => {
    setError(null);
    setDraft({ ...draft, ...patch });
  };

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/automation/teams", { method: "PUT", body: draft });
      setSaved(JSON.stringify(draft));
      toast.success("Settings saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ChannelsCard channels={channels} onChanged={data.refresh} />

      <Card>
        <CardHeader title="Where messages go" description="By default each schedule posts to the channel chosen in the schedule." />
        <div className="flex flex-col gap-3 px-4 py-4">
          <Segmented
            label="Where messages go"
            value={draft.twoChannels ? "two" : "schedule"}
            options={[
              { value: "schedule", label: "The schedule's channel" },
              { value: "two", label: "Two channels" },
            ]}
            onChange={(value) => set({ twoChannels: value === "two" })}
          />
          {draft.twoChannels ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ChannelSelect label="Test results go to" channels={channels} value={draft.resultsChannelId} onChange={(id) => set({ resultsChannelId: id })} />
              <ChannelSelect label="Bug reports go to" channels={channels} value={draft.bugsChannelId} onChange={(id) => set({ bugsChannelId: id })} />
            </div>
          ) : null}
        </div>
      </Card>

      <TemplatesCard
        templates={{ results: draft.resultsTemplate, bug: draft.bugTemplate }}
        defaults={defaults}
        onChange={(kind, value) => set({ [TEMPLATE_FIELD[kind]]: value })}
      />

      <Card>
        <CardHeader
          title="Morning summary"
          description="Every weekday at 08:00, one message with the scheduled runs since the last summary. While it is on, scheduled runs post right away only when they fail."
        />
        <div className="flex flex-wrap items-end gap-3 px-4 py-4">
          <Segmented
            label="Morning summary"
            value={draft.morningEnabled ? "on" : "off"}
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
            ]}
            onChange={(value) => set({ morningEnabled: value === "on" })}
          />
          {draft.morningEnabled ? (
            <ChannelSelect label="Channel" className="min-w-0 flex-[0_1_280px]" channels={channels} value={draft.morningChannelId} onChange={(id) => set({ morningChannelId: id })} />
          ) : null}
        </div>
      </Card>

      {dirty || error ? (
        <div
          className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 shadow-[var(--shadow-pop)]"
          data-testid="save-bar"
        >
          <p role={error ? "alert" : "status"} className={cn("mr-auto text-sm", error ? "text-fail" : problems.length ? "text-fail" : "text-flaky")}>
            {error ?? (problems.length ? "Fix the templates before saving." : "Unsaved changes")}
          </p>
          <Button onClick={discard} disabled={saving || !dirty}>
            Discard
          </Button>
          <Button variant="primary" onClick={save} disabled={saving || !dirty || problems.length > 0}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      ) : null}
      {confirm.dialog}
    </div>
  );
}

function ChannelSelect({
  label,
  channels,
  value,
  onChange,
  className,
}: {
  label: string;
  channels: Channel[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  return (
    <Field label={label} className={className} hint={channels.length ? undefined : "Add a channel first."}>
      {(props) => (
        <Select {...props} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} disabled={!channels.length}>
          <option value="">Choose a channel</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function ChannelsCard({ channels, onChanged }: { channels: Channel[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Channel | "new" | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const confirm = useConfirm();

  async function sendTest(channel: Channel) {
    setTesting(channel.id);
    try {
      await api("/api/automation/teams/test", { body: { channelId: channel.id } });
      toast.success(`Test message sent to ${channel.name}.`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setTesting(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Teams channels"
        description="Each channel is a Teams workflow link. The link stays on the server; only its last characters are shown."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> Add channel
          </Button>
        }
      />
      {channels.length === 0 ? (
        <EmptyState className="m-4" title="No channels yet. Add one to get run results in Teams." />
      ) : (
        <ul>
          {channels.map((channel) => (
            <li key={channel.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-b-0" data-testid="channel-row">
              <div className="min-w-0 flex-[1_1_220px]">
                <p className="truncate font-medium" title={channel.name}>
                  {channel.name}
                </p>
                <p className="text-sm break-words text-muted">
                  {channel.usedBy.length ? `Used by ${channel.usedBy.join(", ")}` : "Not used by a schedule"}
                </p>
              </div>
              <code className="font-mono text-sm text-muted" aria-label="Workflow link, last characters">
                {channel.webhook}
              </code>
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" onClick={() => sendTest(channel)} disabled={testing === channel.id}>
                  <Send className="size-3.5" aria-hidden /> {testing === channel.id ? "Sending..." : "Send test"}
                </Button>
                <DropdownMenu>
                  <MoreButton label={`Actions for ${channel.name}`} />
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setEditing(channel)}>Edit</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      danger
                      onSelect={() =>
                        confirm.ask("Delete this channel?", <>{channel.name} will be removed. Schedules can no longer post to it.</>, "Delete", async () => {
                          try {
                            await api(`/api/automation/teams/channels/${channel.id}`, { method: "DELETE" });
                            toast.success("Channel deleted.");
                            onChanged();
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
              </div>
            </li>
          ))}
        </ul>
      )}
      <SetupHelp />
      {editing ? (
        <ChannelDialog
          channel={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}
      {confirm.dialog}
    </Card>
  );
}

function SetupHelp() {
  return (
    <details className="group border-t border-line px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-ink select-none">How to get a workflow link</summary>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-muted">
        <li>In Teams, open the channel, click the three dots next to its name and choose Workflows.</li>
        <li>Pick the template &quot;Post to a channel when a webhook request is received&quot; and give it a name.</li>
        <li>Choose the team and the channel, then click Add workflow.</li>
        <li>Copy the link Teams shows at the end and paste it here with Add channel. Use Send test to check it.</li>
      </ol>
    </details>
  );
}

function ChannelDialog({ channel, onClose, onSaved }: { channel: Channel | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(channel?.name ?? "");
  const [link, setLink] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ field: "name" | "link"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError({ field: "name", message: "Give the channel a name." });
    if (!channel && !link.trim()) return setError({ field: "link", message: "Paste the workflow link." });
    setSaving(true);
    try {
      const body = { name: name.trim(), webhookUrl: link.trim() };
      if (channel) await api(`/api/automation/teams/channels/${channel.id}`, { method: "PUT", body });
      else await api("/api/automation/teams/channels", { body });
      toast.success(channel ? "Channel saved." : "Channel added.");
      onSaved();
    } catch (err) {
      const message = (err as Error).message;
      setError({ field: /link|workflow/i.test(message) ? "link" : "name", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={channel ? "Edit channel" : "Add channel"}
        size="sm"
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form="channel-form" disabled={saving}>
              {saving ? "Saving..." : channel ? "Save" : "Add channel"}
            </Button>
          </>
        }
      >
        <form id="channel-form" onSubmit={save} className="flex flex-col gap-4" noValidate>
          <Field label="Name" error={error?.field === "name" ? error.message : null}>
            {(props) => (
              <Input
                {...props}
                value={name}
                maxLength={60}
                placeholder="QA results"
                autoFocus
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
            )}
          </Field>
          <Field
            label="Workflow link"
            error={error?.field === "link" ? error.message : null}
            hint={channel ? `Leave empty to keep the saved link (${channel.webhook}).` : "A Teams or Power Automate workflow link."}
          >
            {(props) => (
              <div className="relative">
                <Input
                  {...props}
                  type={show ? "text" : "password"}
                  className="pr-9 font-mono"
                  value={link}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={channel ? channel.webhook : "https://...webhook.office.com/..."}
                  onChange={(e) => {
                    setLink(e.target.value);
                    setError(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide link" : "Show link"}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted hover:bg-hover hover:text-ink"
                >
                  {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TemplatesCard({
  templates,
  defaults,
  onChange,
}: {
  templates: Record<TemplateKind, string>;
  defaults: Record<TemplateKind, string>;
  onChange: (kind: TemplateKind, value: string) => void;
}) {
  const [kind, setKind] = useState<TemplateKind>("results");
  const area = useRef<HTMLTextAreaElement>(null);
  const value = templates[kind];
  const problems = validateTemplate(kind, value);
  const preview = renderTemplate(value, SAMPLE_VALUES[kind]);
  const [title, ...rest] = preview.split("\n");

  // A chip goes in where the cursor is (or replaces the selected text).
  function insert(name: string) {
    const el = area.current;
    const token = `{{${name}}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(kind, value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Message templates"
        description="The first line is the title of the message. A paragraph whose placeholders are all empty is left out."
        actions={
          <Button size="sm" onClick={() => onChange(kind, defaults[kind])} disabled={value === defaults[kind]}>
            <RotateCcw className="size-3.5" aria-hidden /> Reset to default
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-4 py-4">
        <Segmented
          label="Template"
          value={kind}
          options={[
            { value: "results", label: "Test results" },
            { value: "bug", label: "Bug report" },
          ]}
          onChange={(next) => setKind(next as TemplateKind)}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap gap-1.5" aria-label="Placeholders">
              {PLACEHOLDERS[kind].map((p) => (
                <button
                  key={p.name}
                  type="button"
                  title={p.description}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(p.name)}
                  className="rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-xs text-muted hover:border-line-strong hover:text-ink"
                >
                  {`{{${p.name}}}`}
                </button>
              ))}
            </div>
            <Textarea
              ref={area}
              aria-label={kind === "results" ? "Test results template" : "Bug report template"}
              aria-invalid={problems.length > 0}
              className="min-h-72 font-mono text-sm"
              spellCheck={false}
              value={value}
              onChange={(e) => onChange(kind, e.target.value)}
            />
            {problems.length ? (
              <ul role="alert" className="flex flex-col gap-0.5 text-sm text-fail">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted">Preview with example values</p>
            <div className="rounded-md border border-line bg-subtle p-3" data-testid="template-preview">
              <div className="rounded-md border border-line bg-surface px-3.5 py-3">
                <p className="font-semibold break-words text-ink">{title || <span className="text-faint">No title</span>}</p>
                {rest.length ? <p className="mt-1.5 text-sm break-words whitespace-pre-wrap text-ink">{rest.join("\n").trim()}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
