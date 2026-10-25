"use client";

import { useState } from "react";

import { Button } from "./button";
import { Dialog, DialogContent } from "./dialog";

/** A confirmation dialog: `ask(...)` opens it, the action runs only on "Yes". */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: React.ReactNode; action: string; run: () => Promise<void> | void } | null>(null);
  const [busy, setBusy] = useState(false);

  const dialog = (
    <Dialog open={state !== null} onOpenChange={(open) => !open && setState(null)}>
      {state ? (
        <DialogContent
          title={state.title}
          size="sm"
          footer={
            <>
              <Button onClick={() => setState(null)}>Cancel</Button>
              <Button
                variant="danger"
                disabled={busy}
                data-testid="confirm-yes"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await state.run();
                  } finally {
                    setBusy(false);
                    setState(null);
                  }
                }}
              >
                {state.action}
              </Button>
            </>
          }
        >
          <div className="text-base text-muted">{state.body}</div>
        </DialogContent>
      ) : null}
    </Dialog>
  );

  return {
    ask: (title: string, body: React.ReactNode, action: string, run: () => Promise<void> | void) => setState({ title, body, action, run }),
    dialog,
  };
}
