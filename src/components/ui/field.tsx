import { forwardRef, useId } from "react";

import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-md border border-line bg-surface px-2.5 text-base text-ink placeholder:text-faint " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 " +
  "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-fail";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL, "h-8", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(CONTROL, "min-h-20 py-1.5 leading-5", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(CONTROL, "h-8 pr-7", className)} {...props} />;
  },
);

/** A labelled control with an optional hint and error. The control gets the id and aria attributes. */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": error || hint ? messageId : undefined })}
      {error ? (
        <p id={messageId} className="text-sm text-fail" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
