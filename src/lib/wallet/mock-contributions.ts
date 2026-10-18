import { mockActiveGoalForReservation } from "@/lib/goals/mock";
import { mockAddPaidCents } from "@/lib/reservations/mock";
import {
  buildContributionPlan,
  calendarToday,
  installmentCentsAt,
  isContributionFrequency,
} from "@/lib/reservations/contribution-plan";
import type { Contribution } from "@/lib/wallet/types";

function store(): Map<string, Contribution[]> {
  const scope = globalThis as typeof globalThis & {
    __iplanetMockContributions?: Map<string, Contribution[]>;
  };
  if (!scope.__iplanetMockContributions) {
    scope.__iplanetMockContributions = new Map();
  }
  return scope.__iplanetMockContributions;
}

/**
 * Mock has no Pix confirmation. A goal with no recorded aportes gets one
 * confirmed payment that covers the first installment and half of the next,
 * so the following aporte shows the reduced amount.
 */
export function mockContributionsForReservation(reservationId: string): Contribution[] {
  const saved = store().get(reservationId);
  if (saved && saved.length > 0) return saved;

  const seeded = seedSurplus(reservationId);
  if (seeded.length > 0) store().set(reservationId, seeded);
  return seeded;
}

function seedSurplus(reservationId: string): Contribution[] {
  const goal = mockActiveGoalForReservation(reservationId);
  if (!goal?.plan_start_date || !isContributionFrequency(goal.frequency)) return [];
  if (goal.reservation_id !== reservationId) return [];

  let plan;
  try {
    plan = buildContributionPlan({
      targetCents: goal.amount_cents,
      contributedCents: 0,
      startDate: goal.plan_start_date,
      endDate: goal.target_date,
      frequency: goal.frequency,
    });
  } catch {
    return [];
  }
  if (plan.installmentCount < 2) return [];

  const first = installmentCentsAt(plan, 0);
  const second = installmentCentsAt(plan, 1);
  const amountCents = first + Math.floor(second / 2);
  if (amountCents <= 0) return [];

  const today = calendarToday();
  const paidOn = goal.plan_start_date <= today ? goal.plan_start_date : today;
  const confirmedAt = `${paidOn}T15:00:00.000Z`;
  mockAddPaidCents(reservationId, amountCents);

  return [
    {
      id: `mock-surplus-${reservationId}`,
      user_id: goal.user_id,
      reservation_id: reservationId,
      amount_cents: amountCents,
      payment_method: "pix",
      status: "confirmed",
      pix_code: null,
      pix_qr_base64: null,
      gateway_payment_id: null,
      gateway_provider: null,
      confirmed_at: confirmedAt,
      created_at: confirmedAt,
      updated_at: confirmedAt,
    },
  ];
}
