import { cn } from "@/lib/cn";

export type Tone = "neutral" | "accent" | "pass" | "fail" | "flaky" | "skip" | "known" | "run";

const TONES: Record<Tone, string> = {
  neutral: "bg-hover text-muted",
  accent: "bg-accent-soft text-accent",
  pass: "bg-pass-soft text-pass",
  fail: "bg-fail-soft text-fail",
  flaky: "bg-flaky-soft text-flaky",
  skip: "bg-skip-soft text-skip",
  known: "bg-known-soft text-known",
  run: "bg-run-soft text-run",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** A small status dot, for places where a full badge is too loud. */
export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  const colour: Record<Tone, string> = {
    neutral: "bg-faint",
    accent: "bg-accent",
    pass: "bg-pass",
    fail: "bg-fail",
    flaky: "bg-flaky",
    skip: "bg-skip",
    known: "bg-known",
    run: "bg-run",
  };
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", colour[tone], className)} />;
}
