import type { InstallmentResolution, InstallmentStatus } from "../calendar-marks.ts";
import { resolveContributionSlots } from "../calendar-marks.ts";
import {
  applyEarlyPayments,
  installmentCentsAt,
  type AppliedInstallment,
  type ContributionPlan,
  type PlanContribution,
} from "../../reservations/contribution-plan.ts";
import {
  climbDaysLate,
  climbStreak,
  deriveStatus,
} from "./goal-logic.ts";
import type { Deposit, DepositStatus, GoalState, PrizeKind } from "./types.ts";

/** Agenda real de uma meta, já no formato do calendário de aportes. */
export interface ClimbGoalInput {
  id: string;
  name: string;
  productName: string;
  /** Preço do produto, em centavos. */
  targetCents: number;
  /** Valor já confirmado na reserva, em centavos. */
  savedCents: number;
  /** Dia civil de São Paulo, yyyy-mm-dd. */
  today: string;
  plan: ContributionPlan;
  contributions: PlanContribution[];
}

/**
 * Mapeia a meta e a agenda reais para o estado da escalada.
 * O status sai da agenda: vencido sem pagamento atrasa; o próximo aporte
 * hoje ou amanhã fica quase atrasado; 100% do preço conquista a meta.
 */
export function climbGoalFromPlan(input: ClimbGoalInput): GoalState {
  const contributions = input.contributions.filter(
    (contribution) => contribution.amountCents > 0,
  );
  const slots = resolveContributionSlots({
    dates: input.plan.dates,
    today: input.today,
    contributions,
  });
  const applied = applyEarlyPayments({
    installments: input.plan.dates.map((date, index) => ({
      dueDate: date,
      amountCents: installmentCentsAt(input.plan, index),
    })),
    contributions,
  });
  const deposits: Deposit[] = slots.map((slot, index) => {
    const row = applied[index];
    const settled = settleClimbSlot(slot, row);
    const amountCents = row?.baseCents ?? installmentCentsAt(input.plan, index);
    return {
      id: `${input.id}-${settled.dueDate}`,
      dueDate: settled.dueDate,
      amount: amountCents / 100,
      status: depositStatusFromInstallment(settled.status),
      paidAt: settled.paidOn ?? undefined,
    };
  });

  const targetAmount = Math.max(0, input.targetCents) / 100;
  const savedAmount = Math.max(0, input.savedCents) / 100;
  const percent =
    targetAmount > 0
      ? Math.max(0, Math.min(100, Math.round((savedAmount / targetAmount) * 100)))
      : 0;
  const status = deriveStatus(deposits, percent, input.today);

  return {
    id: input.id,
    name: input.name,
    product: {
      name: input.productName,
      kind: prizeKindFromProductName(input.productName),
    },
    status,
    targetAmount,
    savedAmount,
    percent,
    deposits,
    daysLate: status === "late" ? climbDaysLate(input.today, deposits) : 0,
    streak: climbStreak(deposits),
  };
}

/** Pagamento antecipado que quita a parcela segue a mesma regra do calendário. */
export function settleClimbSlot(
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

export function depositStatusFromInstallment(status: InstallmentStatus): DepositStatus {
  switch (status) {
    case "on_time":
      return "paid_on_time";
    case "late_payment":
      return "paid_late";
    case "missed":
      return "missed";
    case "upcoming":
      return "pending";
    default: {
      const exhaustive: never = status;
      throw new Error(`Status inválido: ${String(exhaustive)}`);
    }
  }
}

export function prizeKindFromProductName(name: string): PrizeKind {
  const normalized = name.toLowerCase();
  if (
    normalized.includes("airpod") ||
    normalized.includes("fone") ||
    normalized.includes("headphone")
  ) {
    return "headphones";
  }
  if (
    normalized.includes("mac") ||
    normalized.includes("ipad") ||
    normalized.includes("laptop") ||
    normalized.includes("notebook")
  ) {
    return "laptop";
  }
  if (
    normalized.includes("iphone") ||
    normalized.includes("phone") ||
    normalized.includes("celular")
  ) {
    return "phone";
  }
  return "gift";
}
