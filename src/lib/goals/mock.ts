import type { PaymentGoal } from "@/types/database";
import type { ContributionFrequency } from "@/lib/reservations/contribution-plan";

type GoalStore = Map<string, PaymentGoal>;

function store(): GoalStore {
  const scope = globalThis as typeof globalThis & {
    __iplanetPaymentGoals?: GoalStore;
  };
  if (!scope.__iplanetPaymentGoals) {
    scope.__iplanetPaymentGoals = new Map();
  }
  return scope.__iplanetPaymentGoals;
}

export function mockListGoalsForUser(userId: string): PaymentGoal[] {
  return [...store().values()]
    .filter((goal) => goal.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function mockActiveGoalForReservation(
  reservationId: string,
): PaymentGoal | null {
  const rows = [...store().values()].filter(
    (goal) => goal.reservation_id === reservationId && goal.status === "active",
  );
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return rows[0] ?? null;
}

export function mockUpsertGoal(input: {
  userId: string;
  goalId?: string | null;
  productId: string;
  reservationId: string | null;
  name: string;
  targetDate: string;
  reminderDay: number | null;
  reminderAt: string | null;
  amountCents: number;
  installmentCents: number;
  installmentsCount: number;
  whatsappPhone: string | null;
  frequency: ContributionFrequency | null;
  planStartDate: string | null;
}): { ok: true; id: string } | { ok: false; error: string } {
  const now = new Date().toISOString();

  if (input.goalId) {
    const current = store().get(input.goalId);
    if (!current || current.user_id !== input.userId) {
      return { ok: false, error: "Meta não encontrada." };
    }
    const next: PaymentGoal = {
      ...current,
      product_id: input.productId,
      reservation_id: input.reservationId,
      name: input.name,
      target_date: input.targetDate,
      reminder_day: input.reminderDay,
      reminder_at: input.reminderAt,
      amount_cents: input.amountCents,
      installment_cents: input.installmentCents,
      installments_count: input.installmentsCount,
      whatsapp_phone: input.whatsappPhone,
      frequency: input.frequency,
      plan_start_date: input.planStartDate,
      status: "active",
    };
    store().set(current.id, next);
    return { ok: true, id: current.id };
  }

  const id = globalThis.crypto.randomUUID();
  const goal: PaymentGoal = {
    id,
    user_id: input.userId,
    product_id: input.productId,
    reservation_id: input.reservationId,
    name: input.name,
    target_date: input.targetDate,
    reminder_day: input.reminderDay,
    reminder_at: input.reminderAt,
    amount_cents: input.amountCents,
    installment_cents: input.installmentCents,
    installments_count: input.installmentsCount,
    status: "active",
    whatsapp_phone: input.whatsappPhone,
    created_at: now,
    frequency: input.frequency,
    plan_start_date: input.planStartDate,
  };
  store().set(id, goal);
  return { ok: true, id };
}
