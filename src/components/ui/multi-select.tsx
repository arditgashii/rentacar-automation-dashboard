"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { Checkbox } from "./checkbox";

export type Option = { value: string; label: string; hint?: string };

/** A dropdown with checkboxes and a search box. Empty selection reads as `emptyLabel` ("All"). */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel = "All",
  disabled,
  id,
  className,
}: {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );
  const selected = options.filter((option) => value.includes(option.value));
  const text =
    selected.length === 0 ? emptyLabel : selected.length === 1 ? selected[0].label : `${selected.length} selected`;

  const flip = (option: string) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);

  return (
    <Popover.Root onOpenChange={(open) => !open && setQuery("")}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          className={cn(
            "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 text-left text-base",
            "focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted",
            selected.length === 0 && "text-muted",
            className,
          )}
        >
          <span className="truncate" title={selected.map((s) => s.label).join(", ") || undefined}>
            {options.length === 0 && placeholder ? placeholder : text}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-56 rounded-md border border-line bg-surface shadow-[var(--shadow-pop)]"
        >
          {options.length > 6 ? (
            <div className="flex items-center gap-2 border-b border-line px-2.5">
              <Search className="size-3.5 text-faint" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search options"
                className="h-8 w-full bg-transparent text-base outline-none placeholder:text-faint"
              />
            </div>
          ) : null}
          <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-multiselectable>
            {shown.length === 0 ? <p className="px-2 py-2 text-sm text-muted">Nothing matches.</p> : null}
            {shown.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-hover"
                role="option"
                aria-selected={value.includes(option.value)}
              >
                <Checkbox checked={value.includes(option.value)} onCheckedChange={() => flip(option.value)} />
                <span className="min-w-0 flex-1 truncate" title={option.label}>
                  {option.label}
                </span>
                {option.hint ? <span className="shrink-0 text-xs text-faint">{option.hint}</span> : null}
              </label>
            ))}
          </div>
          {value.length > 0 ? (
            <div className="border-t border-line p-1">
              <button type="button" onClick={() => onChange([])} className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted hover:bg-hover">
                Clear
              </button>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
