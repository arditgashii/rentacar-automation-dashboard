"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/cn";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  ...props
}: Menu.DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={4}
        collisionPadding={8}
        className={cn(
          "z-50 min-w-44 rounded-md border border-line bg-surface p-1 text-base shadow-[var(--shadow-pop)]",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: Menu.DropdownMenuItemProps & { danger?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 outline-none select-none",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-hover",
        danger ? "text-fail" : "text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />;
}

/** The "more" button used at the end of rows and in page headers. */
export function MoreButton({ label = "More actions", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }) {
  return (
    <Menu.Trigger asChild>
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink data-[state=open]:bg-hover"
        {...props}
      >
        <MoreHorizontal className="size-4" />
      </button>
    </Menu.Trigger>
  );
}

export const DropdownMenuSub = Menu.Sub;

export function DropdownMenuSubTrigger({ className, ...props }: Menu.DropdownMenuSubTriggerProps) {
  return (
    <Menu.SubTrigger
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 outline-none select-none",
        "data-[highlighted]:bg-hover data-[state=open]:bg-hover",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSubContent({ className, ...props }: Menu.DropdownMenuSubContentProps) {
  return (
    <Menu.Portal>
      <Menu.SubContent
        sideOffset={4}
        collisionPadding={8}
        className={cn("z-50 max-h-72 min-w-48 overflow-y-auto rounded-md border border-line bg-surface p-1 text-base shadow-[var(--shadow-pop)]", className)}
        {...props}
      />
    </Menu.Portal>
  );
}
