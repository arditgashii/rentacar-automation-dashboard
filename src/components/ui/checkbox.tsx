"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/cn";

/** Checked, unchecked or "indeterminate" (part of a group chosen). */
export function Checkbox({
  checked,
  onCheckedChange,
  className,
  ...props
}: {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  className?: string;
} & Omit<RadixCheckbox.CheckboxProps, "checked" | "onCheckedChange">) {
  return (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-surface",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-white",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-white",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadixCheckbox.Indicator>
        {checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
