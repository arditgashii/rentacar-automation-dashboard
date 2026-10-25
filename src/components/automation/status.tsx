import { Badge, Dot, type Tone } from "@/components/ui/badge";
import type { RunStatus, TestOutcome } from "@/lib/automation/types";

export const RUN_STATUS: Record<RunStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "run" },
  passed: { label: "Passed", tone: "pass" },
  failed: { label: "Failed", tone: "fail" },
  stopped: { label: "Stopped", tone: "skip" },
  error: { label: "Error", tone: "fail" },
  not_ready: { label: "Not ready", tone: "flaky" },
};

export const OUTCOME: Record<TestOutcome, { label: string; tone: Tone }> = {
  passed: { label: "Passed", tone: "pass" },
  failed: { label: "Failed", tone: "fail" },
  flaky: { label: "Flaky", tone: "flaky" },
  skipped: { label: "Skipped", tone: "skip" },
  known_bug: { label: "Known bug", tone: "known" },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const { label, tone } = RUN_STATUS[status];
  return (
    <Badge tone={tone} data-testid="run-status">
      {status === "running" ? <span className="size-1.5 animate-pulse rounded-full bg-current" /> : null}
      {label}
    </Badge>
  );
}

export function OutcomeBadge({ outcome }: { outcome: TestOutcome }) {
  const { label, tone } = OUTCOME[outcome];
  return <Badge tone={tone}>{label}</Badge>;
}

export function OutcomeDot({ outcome }: { outcome: TestOutcome }) {
  return <Dot tone={OUTCOME[outcome].tone} />;
}
