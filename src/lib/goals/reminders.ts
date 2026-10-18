import { addCalendarDays, formatPlanDate } from "../reservations/contribution-plan.ts";

export type ReminderKind = "day_before" | "late";

export interface ReminderSent {
  dayBefore: boolean;
  late: boolean;
}

export type ReminderDecision =
  | { send: false; kind: null; body: null }
  | { send: true; kind: ReminderKind; body: string };

export function dayBeforeReminder(
  reservationName: string,
  goalName: string,
  dueDate: string,
): string {
  return `Lembrete: a reserva ${reservationName} da meta ${goalName} vence amanhã (${formatPlanDate(dueDate)}). Faça seu aporte para cumprir o prazo.`;
}

export function lateReminder(
  reservationName: string,
  goalName: string,
  dueDate: string,
): string {
  return `A meta ${goalName} da reserva ${reservationName} está atrasada. O aporte de ${formatPlanDate(dueDate)} ainda não foi feito.`;
}

/**
 * Day-before asks for the aporte once. The due date with no payment sends
 * the late notice once. An on-time payment (paid on or before the due date)
 * sends neither. A notice already recorded is not chosen again.
 * This function never sends a message.
 */
export function contributionReminder(input: {
  today: string;
  dueDate: string;
  reservationName: string;
  goalName: string;
  paidOn: string | null;
  sent: ReminderSent;
}): ReminderDecision {
  const paidOnTime = input.paidOn != null && input.paidOn <= input.dueDate;
  if (paidOnTime) return { send: false, kind: null, body: null };

  const dayBefore = addCalendarDays(input.dueDate, -1);
  if (input.today === dayBefore && input.paidOn == null) {
    if (input.sent.dayBefore) return { send: false, kind: null, body: null };
    return {
      send: true,
      kind: "day_before",
      body: dayBeforeReminder(input.reservationName, input.goalName, input.dueDate),
    };
  }

  if (input.today >= input.dueDate && input.paidOn == null) {
    if (input.sent.late) return { send: false, kind: null, body: null };
    return {
      send: true,
      kind: "late",
      body: lateReminder(input.reservationName, input.goalName, input.dueDate),
    };
  }

  return { send: false, kind: null, body: null };
}
