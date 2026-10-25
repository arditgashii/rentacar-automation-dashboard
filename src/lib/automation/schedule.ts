import type { Repeat } from "./types";

export const REPEAT_LABELS: Record<Repeat, string> = {
  off: "Off",
  today: "Today only",
  weekdays: "Weekdays",
  daily: "Every day",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  custom: "Custom",
};

/** Days by Date.getDay() (0 = Sunday) and the order the day picker shows them in. */
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export type ScheduleRule = { repeat: Repeat; days: number[]; time: string };

const STEP_DAYS: Record<Repeat, number> = { off: 0, today: 0, weekdays: 1, daily: 1, weekly: 7, biweekly: 14, custom: 1 };

function atTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days); // calendar days keep the clock time across DST changes
  return result;
}

function allowedDay(rule: ScheduleRule, date: Date): boolean {
  const day = date.getDay();
  if (rule.repeat === "weekdays") return day !== 0 && day !== 6;
  if (rule.repeat === "custom") return rule.days.includes(day);
  return true;
}

function neverRuns(rule: ScheduleRule): boolean {
  return rule.repeat === "off" || (rule.repeat === "custom" && rule.days.length === 0);
}

/**
 * The first slot after `from`, or null when the rule never runs again.
 * "Today only" runs once later today; weekly and every-2-weeks keep the weekday of the first slot.
 */
export function nextRunAt(rule: ScheduleRule, from: Date): Date | null {
  if (neverRuns(rule)) return null;
  let next = atTime(from, rule.time);
  if (rule.repeat === "today") return next > from ? next : null;
  if (next <= from) next = addDays(next, STEP_DAYS[rule.repeat]);
  while (!allowedDay(rule, next)) next = addDays(next, 1);
  return next;
}

/** The slot after one that just ran (or was missed): a weekly schedule moves 7 days, not to tomorrow. */
export function slotAfter(rule: ScheduleRule, slot: Date, now: Date): Date | null {
  if (neverRuns(rule) || rule.repeat === "today") return null;
  let next = slot;
  do {
    next = addDays(next, STEP_DAYS[rule.repeat]);
    while (!allowedDay(rule, next)) next = addDays(next, 1);
  } while (next <= now);
  return next;
}

/** "Weekdays at 07:00", "Every Tuesday, Thursday at 22:00", "Off". */
export function describeRule(rule: ScheduleRule, anchor?: Date | null): string {
  if (rule.repeat === "off") return "Off";
  if (rule.repeat === "custom") {
    const days = WEEK_ORDER.filter((day) => rule.days.includes(day)).map((day) => DAY_LONG[day]);
    return days.length ? `Every ${days.join(", ")} at ${rule.time}` : "No days chosen";
  }
  if ((rule.repeat === "weekly" || rule.repeat === "biweekly") && anchor) {
    const day = DAY_LONG[anchor.getDay()];
    return rule.repeat === "weekly" ? `Every ${day} at ${rule.time}` : `Every 2 weeks on ${day} at ${rule.time}`;
  }
  if (rule.repeat === "today") return `Today at ${rule.time}`;
  return `${REPEAT_LABELS[rule.repeat]} at ${rule.time}`;
}

/** Messages the dialog shows; null when the rule is fine. */
export function validateRule(rule: ScheduleRule, now: Date): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time)) return "Choose a time.";
  if (rule.repeat === "custom" && rule.days.length === 0) return "Choose at least one day.";
  if (rule.repeat === "today" && atTime(now, rule.time) <= now) return "Choose a time later today.";
  return null;
}
