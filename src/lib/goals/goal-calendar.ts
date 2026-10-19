import {
  applyEarlyPayments,
  buildContributionPlan,
  installmentCentsAt,
  type AppliedInstallment,
  type ContributionFrequency,
  type PlanContribution,
} from "../reservations/contribution-plan.ts";
import {
  calendarMarks,
  resolveContributionSlots,
  type InstallmentResolution,
  type InstallmentStatus,
  type MarkedDay,
} from "./calendar-marks.ts";
import { goalHealth, type GoalHealth } from "./journey.ts";

export interface GoalCalendarDue {
  date: string;
  amountCents: number;
  status: InstallmentStatus;
  note?: string;
}

/** Everything the aporte calendar needs, already serializable. */
export interface GoalCalendarData {
  goalName: string;
  frequency: ContributionFrequency;
  installmentCount: number;
  heroCents: number;
  heroLabel?: string;
  lastCents: number;
  deadline: string;
  dues: GoalCalendarDue[];
  marks: MarkedDay[];
  health: GoalHealth;
}

export interface GoalSchedule {
  calendar: GoalCalendarData;
  /** Contributions that count for this goal, from its start date on. */
  contributions: PlanContribution[];
  savedCents: number;
  progressPercent: number;
  applied: AppliedInstallment[];
  slots: InstallmentResolution[];
}

/**
 * A goal on a reservation already in progress starts counting on its start date.
 * Money paid before that is outside the goal, because the goal amount is what remained.
 */
export function goalContributions(
  contributions: readonly PlanContribution[],
  startDate: string,
): PlanContribution[] {
  return contributions.filter(
    (contribution) => contribution.amountCents > 0 && contribution.paidOn >= startDate,
  );
}

export function buildGoalSchedule(input: {
  name: string;
  amountCents: number;
  startDate: string;
  targetDate: string;
  frequency: ContributionFrequency;
  contributions: readonly PlanContribution[];
  today: string;
}): GoalSchedule {
  const plan = buildContributionPlan({
    targetCents: input.amountCents,
    contributedCents: 0,
    startDate: input.startDate,
    endDate: input.targetDate,
    frequency: input.frequency,
  });
  const paid = goalContributions(input.contributions, input.startDate);
  const applied = applyEarlyPayments({
    installments: plan.dates.map((date, index) => ({
      dueDate: date,
      amountCents: installmentCentsAt(plan, index),
    })),
    contributions: paid,
  });
  const slots = resolveContributionSlots({
    dates: plan.dates,
    today: input.today,
    contributions: paid,
  }).map((slot, index) => settleGoalSlot(slot, applied[index]));
  const savedCents = paid.reduce((sum, contribution) => sum + contribution.amountCents, 0);
  const progressPercent =
    input.amountCents > 0
      ? Math.max(0, Math.min(100, Math.round((savedCents / input.amountCents) * 100)))
      : 0;
  const nextOpen = applied.find((row) => !row.paid) ?? null;

  return {
    contributions: paid,
    savedCents,
    progressPercent,
    applied,
    slots,
    calendar: {
      goalName: input.name,
      frequency: input.frequency,
      installmentCount: plan.installmentCount,
      heroCents: nextOpen ? nextOpen.dueCents : 0,
      heroLabel: nextOpen && nextOpen.dueCents < nextOpen.baseCents ? "Próximo aporte" : undefined,
      lastCents: applied.at(-1)?.dueCents ?? plan.lastInstallmentCents,
      deadline: input.targetDate,
      dues: applied.map((row, index) => ({
        date: row.dueDate,
        amountCents: row.paid ? row.baseCents : row.dueCents,
        status: slots[index]?.status ?? "upcoming",
        note: !row.paid && row.antecipado ? "Antecipado" : undefined,
      })),
      marks: calendarMarks(slots),
      health: goalHealth({
        today: input.today,
        dueDates: plan.dates,
        contributions: paid,
        progressPercent,
      }),
    },
  };
}

/** An early payment that settles the installment follows the calendar's on-time rule. */
export function settleGoalSlot(
  slot: InstallmentResolution,
  row: Pick<AppliedInstallment, "paid" | "settledOn"> | undefined,
): InstallmentResolution {
  if (!row?.paid) return slot;
  const late = row.settledOn != null && row.settledOn > slot.dueDate;
  return {
    ...slot,
    status: late ? "late_payment" : "on_time",
    paidOn: row.settledOn,
    missedDays: late ? slot.missedDays : [],
  };
}
