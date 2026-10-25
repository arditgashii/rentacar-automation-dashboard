"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { RunCard } from "@/lib/automation/runs-data";
import type { RunTarget, TestSet } from "@/lib/automation/types";
import { useResource } from "@/lib/client/api";
import { NewRunDialog } from "./new-run-dialog";

export type NowData = {
  running: (RunCard & { currentTitle: string | null }) | null;
  queue: RunCard[];
  nextRun: { id: string; name: string; at: string } | null;
  attention: { runId: string | null; runNumber: number | null; tests: { nodeid: string; title: string; testCaseId: string | null }[] };
  workerAlive: boolean;
};

export type ScheduleForEdit = {
  id: string;
  name: string;
  target: RunTarget;
  testSet: TestSet;
  includeCostly: boolean;
  repeat: string;
  days: number[];
  time: string;
  teamsChannelId: string | null;
  teamsMode: "every" | "failures";
  teamsBugReports: boolean;
};

export type NewRunInit = { mode?: "now" | "schedule"; target?: RunTarget; schedule?: ScheduleForEdit };

type AutomationContext = {
  now: NowData | null;
  refreshNow: () => void;
  openNewRun: (init?: NewRunInit) => void;
  /** Bumped after a run or schedule is created, so lists reload. */
  version: number;
  bump: () => void;
};

const Context = createContext<AutomationContext | null>(null);

export function useAutomation(): AutomationContext {
  const value = useContext(Context);
  if (!value) throw new Error("useAutomation is used outside AutomationProvider");
  return value;
}

export function AutomationProvider({ children }: { children: React.ReactNode }) {
  const now = useResource<NowData>("/api/automation/now", 3000);
  const [dialog, setDialog] = useState<{ open: boolean; init: NewRunInit; key: number }>({ open: false, init: {}, key: 0 });
  const [version, setVersion] = useState(0);
  const { refresh } = now;

  const bump = useCallback(() => {
    setVersion((v) => v + 1);
    refresh();
  }, [refresh]);

  const value = useMemo<AutomationContext>(
    () => ({
      now: now.data,
      refreshNow: refresh,
      openNewRun: (init = {}) => setDialog((d) => ({ open: true, init, key: d.key + 1 })),
      version,
      bump,
    }),
    [now.data, refresh, version, bump],
  );

  return (
    <Context.Provider value={value}>
      {children}
      <NewRunDialog
        key={dialog.key}
        open={dialog.open}
        init={dialog.init}
        busy={Boolean(now.data?.running)}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onDone={bump}
      />
    </Context.Provider>
  );
}
