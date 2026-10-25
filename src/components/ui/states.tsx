import { cn } from "@/lib/cn";
import { Button } from "./button";

/** Grey placeholder rows while a list loads. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-md bg-hover" style={{ opacity: 1 - index * 0.12 }} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-fail/25 bg-fail-soft px-4 py-3">
      <p className="text-base text-fail">{message}</p>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-base text-muted">{title}</p>
      {action}
    </div>
  );
}
