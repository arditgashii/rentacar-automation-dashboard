"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

/**
 * A centred dialog that fits a 390 px screen (full width with a margin, scrolls inside).
 * Radix closes the innermost layer first, so Escape closes an open menu before the dialog.
 */
export function DialogContent({
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  onEscapeKeyDown,
  onInteractOutside,
  ...props
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
} & Pick<RadixDialog.DialogContentProps, "onEscapeKeyDown" | "onInteractOutside" | "onOpenAutoFocus">) {
  const width = { sm: "max-w-[420px]", md: "max-w-[560px]", lg: "max-w-[760px]" }[size];
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
      <RadixDialog.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col",
          "rounded-lg border border-line bg-surface shadow-[var(--shadow-pop)] focus:outline-none",
          width,
          className,
        )}
        onEscapeKeyDown={onEscapeKeyDown}
        onInteractOutside={onInteractOutside}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <RadixDialog.Title className="text-lg font-semibold text-ink">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-0.5 text-sm text-muted">{description}</RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">{typeof title === "string" ? title : ""}</RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            className="-mt-1 -mr-2 rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </RadixDialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
        ) : null}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
