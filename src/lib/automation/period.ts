// The period filter of the Runs page. Everything here is pure, so it is easy to test.

export type PeriodKey = "today" | "yesterday" | "24h" | "7d" | "30d" | "custom";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  custom: "Custom",
};

export const MAX_CUSTOM_DAYS = 31;

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Parses "2026-10-25" as a local date; null for anything else. */
export function parseDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** Problems with a custom range, or null when it is valid. */
export function validateCustom(from: string | null, to: string | null): string | null {
  const start = parseDay(from);
  const end = parseDay(to);
  if (!start || !end) return "Choose both dates.";
  if (start > end) return '"From" cannot be after "To".';
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_CUSTOM_DAYS) return `Choose at most ${MAX_CUSTOM_DAYS} days.`;
  return null;
}

/** [from, to) as dates for a period, or null when a custom range is not valid. */
export function periodRange(
  key: PeriodKey,
  now: Date,
  custom?: { from: string | null; to: string | null },
): { from: Date; to: Date } | null {
  const today = startOfDay(now);
  const day = 86_400_000;
  switch (key) {
    case "today":
      return { from: today, to: new Date(today.getTime() + day) };
    case "yesterday":
      return { from: new Date(today.getTime() - day), to: today };
    case "24h":
      return { from: new Date(now.getTime() - day), to: now };
    case "7d":
      return { from: new Date(today.getTime() - 6 * day), to: new Date(today.getTime() + day) };
    case "30d":
      return { from: new Date(today.getTime() - 29 * day), to: new Date(today.getTime() + day) };
    case "custom": {
      if (!custom || validateCustom(custom.from, custom.to)) return null;
      const from = parseDay(custom.from)!;
      const to = parseDay(custom.to)!;
      return { from, to: new Date(to.getTime() + day) };
    }
  }
}
