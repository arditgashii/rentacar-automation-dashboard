"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/format";

export type RunOption = { id: string; name: string; status: "open" | "completed"; startedAt: string };

/**
 * Pick a release (or sprint) or type a new name and choose Add "...". The list is loaded again every
 * time it opens, so releases another QA just created show up.
 */
export function ReleasePicker({
  label,
  value,
  listUrl,
  canWrite,
  onPick,
  onAdd,
}: {
  label: string;
  value: string;
  listUrl: string;
  canWrite: boolean;
  onPick: (name: string) => void;
  onAdd: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [runs, setRuns] = useState<RunOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  // The field shows the chosen release when the URL changes (Back, a shared link, a new tab).
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(value);
  }

  async function load() {
    setError(null);
    try {
      setRuns((await api<{ runs: RunOption[] }>(listUrl)).runs);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function show() {
    if (open) return;
    setOpen(true);
    setActive(0);
    void load();
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) {
        setOpen(false);
        setText(value);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, value]);

  const q = text.trim().toLowerCase();
  const typed = q && q !== value.toLowerCase();
  const matches = (runs ?? []).filter((r) => !typed || r.name.toLowerCase().includes(q));
  const exact = (runs ?? []).some((r) => r.name.toLowerCase() === q);
  const options: ({ type: "run"; run: RunOption } | { type: "add"; name: string })[] = [
    ...matches.map((run) => ({ type: "run" as const, run })),
    ...(canWrite && q && !exact && runs ? [{ type: "add" as const, name: text.trim() }] : []),
  ];

  async function choose(index: number) {
    const option = options[index];
    if (!option) return;
    if (option.type === "run") {
      setOpen(false);
      setText(option.run.name);
      onPick(option.run.name);
      return;
    }
    setAdding(true);
    try {
      await onAdd(option.name);
      setOpen(false);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div ref={box} className="relative flex min-w-0 flex-col gap-1">
      <label htmlFor={`${listId}-input`} className="text-xs font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={text}
          maxLength={60}
          placeholder={canWrite ? "Pick or type a new name" : "Pick one"}
          onFocus={show}
          onClick={show}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            show();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              show();
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              void choose(active);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              setOpen(false);
              setText(value);
            }
          }}
          className="h-8 w-full rounded-md border border-line bg-surface pr-8 pl-2.5 text-base placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none"
          data-testid="release-input"
        />
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-[var(--shadow-pop)]"
        >
          {error ? (
            <li className="px-3 py-2 text-sm text-fail">{error}</li>
          ) : !runs ? (
            <li className="px-3 py-2 text-sm text-muted">Loading...</li>
          ) : !options.length ? (
            <li className="px-3 py-2 text-sm text-muted">{canWrite ? "Type a name to add the first one." : "Nothing yet."}</li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.type === "run" ? option.run.id : "add"}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(index)}
                className={cn("flex cursor-pointer items-center gap-2 px-3 py-1.5 text-base", index === active && "bg-hover", option.type === "add" && "border-t border-line text-accent")}
              >
                {option.type === "run" ? (
                  <>
                    <span className="min-w-0 flex-1 truncate">{option.run.name}</span>
                    {option.run.status === "completed" ? <Badge tone="neutral">Completed</Badge> : null}
                    <span className="tabular shrink-0 text-xs text-faint">{formatDay(option.run.startedAt)}</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{adding ? "Adding..." : `Add "${option.name}"`}</span>
                  </>
                )}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
