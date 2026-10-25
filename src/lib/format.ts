// Dates, times and durations, written the same way everywhere.

import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatTime(value: string | Date): string {
  return format(new Date(value), "HH:mm");
}

export function formatDateTime(value: string | Date): string {
  return format(new Date(value), "d MMM yyyy, HH:mm");
}

/** "Today", "Yesterday" or "Fri 23 Oct". */
export function formatDay(value: string | Date): string {
  const date = new Date(value);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE d MMM");
}

export function formatRelative(value: string | Date): string {
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

/** "in 2 h 15 min" or "today at 22:00" style for upcoming slots. */
export function formatUpcoming(value: string | Date): string {
  const date = new Date(value);
  return `${formatDay(date)} at ${formatTime(date)}`;
}

export function plural(count: number, word: string, many = `${word}s`): string {
  return `${count} ${count === 1 ? word : many}`;
}
