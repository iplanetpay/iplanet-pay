import {
  addCalendarDays,
  applyEarlyPayments,
  buildContributionPlan,
  formatPlanDate,
  installmentCentsAt,
  isContributionFrequency,
  type AppliedInstallment,
  type PlanContribution,
} from "../reservations/contribution-plan.ts";
import type { PaymentGoalStatus } from "../../types/database.ts";
import { goalContributions } from "./goal-calendar.ts";

export type GoalScheduleKind = "day_before" | "late";
export type GoalScheduleStatus = "pending" | "sent" | "failed" | "cancelled";

export const GOAL_SCHEDULE_KINDS: readonly GoalScheduleKind[] = ["day_before", "late"];

export interface GoalScheduleRow {
  id: string;
  goal_id: string;
  user_id: string;
  due_date: string;
  send_on: string;
  kind: GoalScheduleKind;
  status: GoalScheduleStatus;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

export interface GoalScheduleListItem extends GoalScheduleRow {
  goal_name: string;
}

export type GoalScheduleDraft = Pick<
  GoalScheduleRow,
  "goal_id" | "user_id" | "due_date" | "send_on" | "kind"
>;

export interface GoalPlanFields {
  amount_cents: number;
  frequency: string | null;
  plan_start_date: string | null;
  target_date: string;
}

export interface GoalScheduleReconcile {
  insert: GoalScheduleDraft[];
  cancelIds: string[];
  reviveIds: string[];
}

export type GoalScheduleDecision =
  | { action: "ignore" }
  | { action: "wait" }
  | { action: "send" }
  | { action: "cancel"; reason: string };

export const GOAL_NOTICE_TEMPLATE_NAMES: Record<GoalScheduleKind, string> = {
  day_before: "meta_vespera",
  late: "meta_atraso",
};

export const DEFAULT_GOAL_NOTICE_BODIES: Record<GoalScheduleKind, string> = {
  day_before:
    "Lembrete: a reserva {{reserva}} da meta {{meta}} vence amanhã ({{data}}). Faça seu aporte para cumprir o prazo.",
  late: "A meta {{meta}} da reserva {{reserva}} está atrasada. O aporte de {{data}} ainda não foi feito.",
};

/** The generic template editor saves names as labels ("Meta Vespera"), so lookups compare the slug. */
export function isGoalNoticeTemplate(name: string, kind: GoalScheduleKind): boolean {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return slug === GOAL_NOTICE_TEMPLATE_NAMES[kind];
}

/** The late notice goes out the day after the due date, so a same-day aporte still counts as on time. */
export function scheduleSendOn(dueDate: string, kind: GoalScheduleKind): string {
  switch (kind) {
    case "day_before":
      return addCalendarDays(dueDate, -1);
    case "late":
      return addCalendarDays(dueDate, 1);
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Tipo de aviso inválido: ${String(_exhaustive)}`);
    }
  }
}

/** Same plan the client calendar shows. Goals without a cadence or with a broken plan have no dates. */
export function goalPlanDueDates(goal: GoalPlanFields): string[] {
  return goalInstallments(goal).map((row) => row.dueDate);
}

/** Confirmed contributions from the goal's start date, applied in date order as on the reservation page. */
export function goalAppliedInstallments(
  goal: GoalPlanFields,
  contributions: readonly PlanContribution[],
): AppliedInstallment[] {
  return applyEarlyPayments({
    installments: goalInstallments(goal),
    contributions: goal.plan_start_date
      ? goalContributions(contributions, goal.plan_start_date)
      : contributions,
  });
}

function goalInstallments(goal: GoalPlanFields): { dueDate: string; amountCents: number }[] {
  if (!isContributionFrequency(goal.frequency) || !goal.plan_start_date) return [];
  try {
    const plan = buildContributionPlan({
      targetCents: goal.amount_cents,
      contributedCents: 0,
      startDate: goal.plan_start_date,
      endDate: goal.target_date,
      frequency: goal.frequency,
    });
    return plan.dates.map((dueDate, index) => ({
      dueDate,
      amountCents: installmentCentsAt(plan, index),
    }));
  } catch {
    return [];
  }
}

export function scheduleKey(row: { due_date: string; kind: GoalScheduleKind }): string {
  return `${row.due_date}|${row.kind}`;
}

/** One row per (due date, kind). Rows whose send day already passed are left out. */
export function buildGoalSchedule(input: {
  goalId: string;
  userId: string;
  dueDates: readonly string[];
  today: string;
  kinds?: readonly GoalScheduleKind[];
}): GoalScheduleDraft[] {
  const kinds = input.kinds ?? GOAL_SCHEDULE_KINDS;
  const seen = new Set<string>();
  const rows: GoalScheduleDraft[] = [];
  for (const dueDate of [...input.dueDates].sort()) {
    for (const kind of kinds) {
      const key = scheduleKey({ due_date: dueDate, kind });
      if (seen.has(key)) continue;
      seen.add(key);
      const sendOn = scheduleSendOn(dueDate, kind);
      if (sendOn < input.today) continue;
      rows.push({
        goal_id: input.goalId,
        user_id: input.userId,
        due_date: dueDate,
        send_on: sendOn,
        kind,
      });
    }
  }
  return rows;
}

/**
 * Pending rows missing from the new plan are cancelled; cancelled rows that are
 * back in the plan return to pending. Sent and failed rows are history and stay.
 */
export function reconcileGoalSchedule(input: {
  desired: readonly GoalScheduleDraft[];
  existing: readonly GoalScheduleRow[];
}): GoalScheduleReconcile {
  const existingByKey = new Map(input.existing.map((row) => [scheduleKey(row), row] as const));
  const desiredKeys = new Set<string>();
  const insert: GoalScheduleDraft[] = [];
  const reviveIds: string[] = [];

  for (const draft of input.desired) {
    const key = scheduleKey(draft);
    if (desiredKeys.has(key)) continue;
    desiredKeys.add(key);
    const current = existingByKey.get(key);
    if (!current) {
      insert.push(draft);
      continue;
    }
    if (current.status === "cancelled") reviveIds.push(current.id);
  }

  const cancelIds = input.existing
    .filter((row) => row.status === "pending" && !desiredKeys.has(scheduleKey(row)))
    .map((row) => row.id);

  return { insert, cancelIds, reviveIds };
}

export function goalAcceptsNotices(status: PaymentGoalStatus): boolean {
  switch (status) {
    case "active":
      return true;
    case "paused":
    case "done":
    case "cancelled":
      return false;
    default: {
      const _exhaustive: never = status;
      throw new Error(`Status de meta inválido: ${String(_exhaustive)}`);
    }
  }
}

/** Active goals with a plan that never got schedule rows, such as goals saved before the schedule existed. */
export function goalsMissingSchedule<T extends GoalPlanFields & { id: string; status: PaymentGoalStatus }>(
  goals: readonly T[],
  scheduledGoalIds: ReadonlySet<string>,
): T[] {
  return goals.filter(
    (goal) =>
      goalAcceptsNotices(goal.status) &&
      !scheduledGoalIds.has(goal.id) &&
      goalPlanDueDates(goal).length > 0,
  );
}

export function pendingScheduleIds(existing: readonly GoalScheduleRow[]): string[] {
  return existing.filter((row) => row.status === "pending").map((row) => row.id);
}

export function dueDatePaid(
  applied: readonly AppliedInstallment[],
  dueDate: string,
): boolean {
  return applied.find((row) => row.dueDate === dueDate)?.paid ?? false;
}

/** Never sends a message: only says what the cron should do with the row. */
export function decideScheduleRow(input: {
  row: Pick<GoalScheduleRow, "status" | "send_on" | "due_date" | "kind">;
  today: string;
  goalStatus: PaymentGoalStatus;
  dueInPlan: boolean;
  paid: boolean;
}): GoalScheduleDecision {
  if (input.row.status !== "pending") return { action: "ignore" };
  if (input.row.send_on > input.today) return { action: "wait" };
  if (!goalAcceptsNotices(input.goalStatus)) {
    return { action: "cancel", reason: "Meta não está ativa." };
  }
  if (!input.dueInPlan) return { action: "cancel", reason: "Data fora do plano." };
  if (input.paid) return { action: "cancel", reason: "Aporte já feito." };
  switch (input.row.kind) {
    case "day_before":
      if (input.today >= input.row.due_date) {
        return { action: "cancel", reason: "Véspera já passou." };
      }
      return { action: "send" };
    case "late":
      return { action: "send" };
    default: {
      const _exhaustive: never = input.row.kind;
      throw new Error(`Tipo de aviso inválido: ${String(_exhaustive)}`);
    }
  }
}

export function renderGoalNotice(
  body: string,
  vars: { meta: string; reserva: string; dueDate: string; nome?: string; valor?: string },
): string {
  const values: Record<string, string> = {
    meta: vars.meta,
    reserva: vars.reserva,
    data: formatPlanDate(vars.dueDate),
    nome: vars.nome ?? "",
    valor: vars.valor ?? "",
  };
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

export function scheduleKindLabel(kind: GoalScheduleKind): string {
  switch (kind) {
    case "day_before":
      return "Véspera do aporte";
    case "late":
      return "Aporte atrasado";
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Tipo de aviso inválido: ${String(_exhaustive)}`);
    }
  }
}

export function scheduleStatusLabel(status: GoalScheduleStatus): string {
  switch (status) {
    case "pending":
      return "Agendado";
    case "sent":
      return "Enviado";
    case "failed":
      return "Falhou";
    case "cancelled":
      return "Cancelado";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Status de aviso inválido: ${String(_exhaustive)}`);
    }
  }
}
