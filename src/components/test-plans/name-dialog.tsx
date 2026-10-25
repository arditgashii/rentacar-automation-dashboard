"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";

/** Asks for one name (new project, suite or folder, or a rename). Errors from the server show under the field. */
export function NameDialog({
  title,
  label,
  initial,
  action,
  submit,
  onClose,
}: {
  title: string;
  label: string;
  initial: string;
  action: string;
  submit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give it a name.");
    if (name.trim() === initial) return onClose();
    setBusy(true);
    try {
      await submit(name.trim());
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={title}
        size="sm"
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form="name-form" disabled={busy}>
              {action}
            </Button>
          </>
        }
      >
        <form id="name-form" onSubmit={save} noValidate>
          <Field label={label} error={error}>
            {(props) => (
              <Input
                {...props}
                autoFocus
                maxLength={120}
                value={name}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  setName(e.target.value);
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
