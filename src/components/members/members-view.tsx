"use client";

import { Copy, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreButton } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page";
import { ErrorState, SkeletonRows } from "@/components/ui/states";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { api, useResource } from "@/lib/client/api";
import { formatDay } from "@/lib/format";

type Member = { id: string; email: string; name: string; role: Role | null; createdAt: string };

const ROLE_HINTS: Record<Role, string> = {
  admin: "Everything, including Automation Tests, Settings and Members.",
  editor: "Changes Test Plans and Manual Regression.",
  viewer: "Reads Test Plans and Manual Regression.",
};

/** A readable temporary password: 4 groups of letters and numbers, no look-alike characters. */
function temporaryPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const raw = [...bytes].map((b) => chars[b % chars.length]).join("");
  const groups = raw.match(/.{4}/g)!.join("-");
  return /\d/.test(groups) ? groups : `${groups.slice(0, -1)}7`;
}

export function MembersView() {
  const list = useResource<{ members: Member[]; you: string }>("/api/members");
  const [adding, setAdding] = useState(false);
  const [passwordFor, setPasswordFor] = useState<Member | null>(null);
  const confirm = useConfirm();

  async function changeRole(member: Member, role: Role) {
    try {
      await api(`/api/members/${member.id}`, { method: "PATCH", body: { role } });
      toast.success(`${member.name} is now ${ROLE_LABELS[role]}.`);
      list.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Members" }]}
        title="Members"
        actions={
          <Button variant="primary" onClick={() => setAdding(true)} data-testid="add-member">
            <Plus className="size-4" aria-hidden /> Add member
          </Button>
        }
      />
      <ul className="mb-4 flex flex-col gap-1 text-sm text-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
        {(Object.keys(ROLE_HINTS) as Role[]).map((role) => (
          <li key={role}>
            <span className="font-medium text-ink">{ROLE_LABELS[role]}:</span> {ROLE_HINTS[role]}
          </li>
        ))}
      </ul>

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full table-fixed text-base">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-line bg-subtle text-left text-sm text-muted">
                <th className="px-4 py-2 font-medium">Member</th>
                <th className="w-44 px-3 py-2 font-medium">Role</th>
                <th className="w-32 px-3 py-2 font-medium">Added</th>
                <th className="w-12 px-3 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.data.members.map((m) => {
                const you = m.id === list.data!.you;
                return (
                  <tr key={m.id} className="flex flex-wrap items-center gap-x-3 border-b border-line px-1 py-1 last:border-b-0 md:table-row md:p-0" data-testid="member-row">
                    <td className="min-w-0 flex-[1_1_100%] px-3 py-2 md:px-4">
                      <p className="flex items-center gap-2 truncate font-medium">
                        <span className="truncate" title={m.name}>
                          {m.name}
                        </span>
                        {you ? <Badge tone="accent">You</Badge> : null}
                      </p>
                      <p className="truncate text-sm text-muted" title={m.email}>
                        {m.email}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      {you ? (
                        <span className="text-sm">{m.role ? ROLE_LABELS[m.role] : "No access"}</span>
                      ) : (
                        <Select aria-label={`Role of ${m.name}`} className="w-36" value={m.role ?? ""} onChange={(e) => changeRole(m, e.target.value as Role)}>
                          {m.role ? null : <option value="">No access</option>}
                          {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </td>
                    <td className="tabular px-3 py-2 text-sm text-muted">{formatDay(m.createdAt)}</td>
                    <td className="ml-auto px-3 py-2 text-right">
                      <DropdownMenu>
                        <MoreButton label={`Actions for ${m.name}`} />
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setPasswordFor(m)}>Set a new password</DropdownMenuItem>
                          {you ? null : (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                danger
                                onSelect={() =>
                                  confirm.ask("Remove this member?", <>{m.name} ({m.email}) can no longer log in. What they did stays in the history.</>, "Remove", async () => {
                                    try {
                                      await api(`/api/members/${m.id}`, { method: "DELETE" });
                                      toast.success(`${m.name} removed.`);
                                      list.refresh();
                                    } catch (error) {
                                      toast.error((error as Error).message);
                                    }
                                  })
                                }
                              >
                                Remove
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <MemberDialog
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            list.refresh();
          }}
        />
      ) : null}
      {passwordFor ? <PasswordDialog member={passwordFor} onClose={() => setPasswordFor(null)} /> : null}
      {confirm.dialog}
    </>
  );
}

function PasswordInput({ value, onChange, ...props }: { value: string; onChange: (value: string) => void; id: string; "aria-invalid": boolean; "aria-describedby"?: string }) {
  return (
    <div className="flex gap-2">
      <Input {...props} value={value} autoComplete="new-password" spellCheck={false} className="font-mono" onChange={(e) => onChange(e.target.value)} />
      <Button type="button" icon aria-label="Generate a password" title="Generate a password" onClick={() => onChange(temporaryPassword())}>
        <RefreshCw className="size-4" />
      </Button>
      <Button
        type="button"
        icon
        aria-label="Copy the password"
        title="Copy the password"
        disabled={!value}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast.success("Password copied.");
          } catch {
            toast.error("Could not copy. Select the password and copy it by hand.");
          }
        }}
      >
        <Copy className="size-4" />
      </Button>
    </div>
  );
}

function MemberDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ email: "", name: "", role: "viewer" as Role, password: temporaryPassword() });
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => {
    setForm({ ...form, ...patch });
    setError(null);
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/members", { body: form });
      toast.success(`${form.name} added. Pass on the temporary password; they can log in now.`, { duration: 8000 });
      onSaved();
    } catch (err) {
      const message = (err as Error).message;
      const field = /^(email|name|password)/.exec(message)?.[1] ?? (/email|member/i.test(message) ? "email" : /password|characters|letter|number/i.test(message) ? "password" : "name");
      setError({ field, message: message.replace(/^\w+: /, "") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Add member"
        size="sm"
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form="member-form" disabled={busy}>
              Add member
            </Button>
          </>
        }
      >
        <form id="member-form" onSubmit={save} className="flex flex-col gap-4" noValidate>
          <Field label="Email" error={error?.field === "email" ? error.message : null}>
            {(props) => <Input {...props} type="email" autoFocus value={form.email} maxLength={255} onChange={(e) => set({ email: e.target.value })} />}
          </Field>
          <Field label="Name" error={error?.field === "name" ? error.message : null}>
            {(props) => <Input {...props} value={form.name} maxLength={100} onChange={(e) => set({ name: e.target.value })} />}
          </Field>
          <Field label="Role" hint={ROLE_HINTS[form.role]}>
            {(props) => (
              <Select {...props} value={form.role} onChange={(e) => set({ role: e.target.value as Role })}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Temporary password" error={error?.field === "password" ? error.message : null} hint="At least 10 characters with a letter and a number. Pass it on yourself; it is not sent anywhere.">
            {(props) => <PasswordInput {...props} value={form.password} onChange={(password) => set({ password })} />}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const [password, setPassword] = useState(temporaryPassword);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/members/${member.id}`, { method: "PATCH", body: { password } });
      toast.success(`New password set for ${member.name}.`);
      onClose();
    } catch (err) {
      setError((err as Error).message.replace(/^\w+: /, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Set a new password"
        description={`${member.name} (${member.email}) logs in with this password from now on.`}
        size="sm"
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form="password-form" disabled={busy}>
              Save password
            </Button>
          </>
        }
      >
        <form id="password-form" onSubmit={save} noValidate>
          <Field label="New password" error={error} hint="At least 10 characters with a letter and a number.">
            {(props) => (
              <PasswordInput
                {...props}
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setError(null);
                }}
              />
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
