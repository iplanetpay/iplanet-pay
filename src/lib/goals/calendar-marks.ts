import {
  addCalendarDays,
  type PlanContribution,
} from "../reservations/contribution-plan.ts";

export type InstallmentStatus = "on_time" | "late_payment" | "missed" | "upcoming";

export type CalendarMark =
  | "due"
  | "on_time"
  | "late_due"
  | "late_paid"
  | "missed"
  | "upcoming";

export interface InstallmentResolution {
  dueDate: string;
  status: InstallmentStatus;
  paidOn: string | null;
  /** Overdue days that stay on the calendar after a later payment. */
  missedDays: string[];
}

export interface MarkedDay {
  date: string;
  marks: CalendarMark[];
}

const MARK_ORDER: readonly CalendarMark[] = [
  "due",
  "on_time",
  "late_due",
  "late_paid",
  "missed",
  "upcoming",
];

export function installmentStatusLabel(status: InstallmentStatus): string {
  switch (status) {
    case "on_time":
      return "Aportado no prazo";
    case "late_payment":
      return "Aportado atrasado";
    case "missed":
      return "Não aportado";
    case "upcoming":
      return "A aportar";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Status inválido: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Pairs each due date with a payment.
 * On time: paid inside (previous due, this due].
 * Late: paid after the due date and before the next one.
 * Missed: the due date passed with no payment. Every day from the due
 * date through today (stopping before the next due date) stays marked.
 * A late payment keeps the days strictly between the due date and the
 * payment marked, even after the money arrives.
 */
export function resolveContributionSlots(input: {
  dates: string[];
  today: string;
  contributions: PlanContribution[];
}): InstallmentResolution[] {
  const dates = input.dates;
  const pool = input.contributions
    .filter(
      (contribution) =>
        contribution.amountCents > 0 &&
        contribution.paidOn <= input.today &&
        /^\d{4}-\d{2}-\d{2}$/.test(contribution.paidOn),
    )
    .map((contribution) => ({ paidOn: contribution.paidOn, used: false }))
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn));

  const resolutions: InstallmentResolution[] = [];

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    const previous = index > 0 ? dates[index - 1] : "";
    const next = index + 1 < dates.length ? dates[index + 1] : null;
    const onTime = pool.find(
      (contribution) =>
        !contribution.used &&
        contribution.paidOn > previous &&
        contribution.paidOn <= date,
    );
    if (onTime) {
      onTime.used = true;
      resolutions.push({
        dueDate: date,
        status: "on_time",
        paidOn: onTime.paidOn,
        missedDays: [],
      });
      continue;
    }
    if (date >= input.today) {
      resolutions.push({
        dueDate: date,
        status: "upcoming",
        paidOn: null,
        missedDays: [],
      });
      continue;
    }
    const late = pool.find((contribution) => {
      if (contribution.used) return false;
      if (contribution.paidOn <= date || contribution.paidOn > input.today) return false;
      if (next && contribution.paidOn >= next) return false;
      return true;
    });
    if (late) {
      late.used = true;
      resolutions.push({
        dueDate: date,
        status: "late_payment",
        paidOn: late.paidOn,
        missedDays: daysStrictlyBetween(date, late.paidOn),
      });
      continue;
    }
    resolutions.push({
      dueDate: date,
      status: "missed",
      paidOn: null,
      missedDays: missedStretch(date, input.today, next),
    });
  }

  return resolutions;
}

export function calendarMarks(resolutions: InstallmentResolution[]): MarkedDay[] {
  const map = new Map<string, Set<CalendarMark>>();
  const add = (date: string, mark: CalendarMark) => {
    const set = map.get(date) ?? new Set<CalendarMark>();
    set.add(mark);
    map.set(date, set);
  };

  for (const slot of resolutions) {
    add(slot.dueDate, "due");
    switch (slot.status) {
      case "on_time":
        add(slot.dueDate, "on_time");
        break;
      case "late_payment":
        add(slot.dueDate, "late_due");
        if (slot.paidOn) add(slot.paidOn, "late_paid");
        for (const day of slot.missedDays) add(day, "missed");
        break;
      case "missed":
        for (const day of slot.missedDays) add(day, "missed");
        break;
      case "upcoming":
        add(slot.dueDate, "upcoming");
        break;
      default: {
        const _exhaustive: never = slot.status;
        throw new Error(`Status inválido: ${String(_exhaustive)}`);
      }
    }
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, marks]) => ({
      date,
      marks: MARK_ORDER.filter((mark) => marks.has(mark)),
    }));
}

/** Months that contain aporte dates, earliest first. */
export function planMonthKeys(dates: string[]): string[] {
  const keys: string[] = [];
  for (const date of [...dates].sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const key = date.slice(0, 7);
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/**
 * Prefer the next upcoming aporte. Otherwise the current month when it is in the plan.
 * Otherwise the first plan month.
 */
export function defaultMonthIndex(input: {
  months: readonly string[];
  today: string;
  upcomingDate: string | null;
}): number {
  if (input.months.length === 0) return 0;
  if (input.upcomingDate) {
    const upcoming = input.months.indexOf(input.upcomingDate.slice(0, 7));
    if (upcoming >= 0) return upcoming;
  }
  const current = input.months.indexOf(input.today.slice(0, 7));
  if (current >= 0) return current;
  return 0;
}

export function stepMonthIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  const next = index + delta;
  if (next < 0) return 0;
  if (next > count - 1) return count - 1;
  return next;
}

function missedStretch(due: string, today: string, nextDue: string | null): string[] {
  if (today < due) return [];
  let end = today;
  if (nextDue && nextDue <= today) end = addCalendarDays(nextDue, -1);
  if (end < due) return [];
  return eachDay(due, end);
}

function daysStrictlyBetween(due: string, paidOn: string): string[] {
  const start = addCalendarDays(due, 1);
  const end = addCalendarDays(paidOn, -1);
  if (end < start) return [];
  return eachDay(start, end);
}

function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end && days.length < 800) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}
