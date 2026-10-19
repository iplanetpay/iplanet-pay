import { climbGoalFromPlan } from "@/lib/goals/climb/adapter";
import { isClimbableGoal, type ClimbGoalEntry } from "@/lib/goals/climb/goal-cards";
import { buildGoalSchedule } from "@/lib/goals/goal-calendar";
import { listPaymentGoalsForUser } from "@/lib/goals/queries";
import { getReservationById } from "@/lib/reservations/queries";
import { buildContributionPlan, calendarToday, isoDateInTimeZone } from "@/lib/reservations/contribution-plan";
import { listContributionsForReservation } from "@/lib/wallet/queries";
import type { Contribution } from "@/lib/wallet/types";
import type { PaymentGoal } from "@/types/database";

/** Todas as metas da pessoa que já têm agenda, na ordem em que foram salvas. */
export async function loadClimbEntries(userId: string): Promise<ClimbGoalEntry[]> {
  const goals = await listPaymentGoalsForUser(userId);
  const built = await Promise.all(goals.filter(isClimbableGoal).map(entryFor));
  return built.filter((entry): entry is ClimbGoalEntry => entry != null);
}

async function entryFor(goal: PaymentGoal): Promise<ClimbGoalEntry | null> {
  if (!isClimbableGoal(goal)) return null;
  const reservationId = goal.reservation_id;
  try {
    const { contributions } = await listContributionsForReservation(reservationId);
    const { reservation } = await getReservationById(reservationId);
    if (!reservation) return null;
    const today = calendarToday();
    const marks = confirmedMarks(contributions);
    const plan = buildContributionPlan({
      targetCents: goal.amount_cents,
      contributedCents: 0,
      startDate: goal.plan_start_date,
      endDate: goal.target_date,
      frequency: goal.frequency,
    });
    const schedule = buildGoalSchedule({
      name: goal.name,
      amountCents: goal.amount_cents,
      startDate: goal.plan_start_date,
      targetDate: goal.target_date,
      frequency: goal.frequency,
      contributions: marks,
      today,
    });
    return {
      depositHref: `/app/reserva/${reservationId}`,
      calendar: schedule.calendar,
      today,
      goal: climbGoalFromPlan({
        id: goal.id,
        name: goal.name,
        productName: reservation.product?.name ?? "Reserva",
        targetCents: goal.amount_cents,
        savedCents: schedule.savedCents,
        today,
        plan,
        contributions: schedule.contributions,
      }),
    };
  } catch {
    return null;
  }
}

function confirmedMarks(contributions: Contribution[]) {
  const marks: { paidOn: string; amountCents: number }[] = [];
  for (const contribution of contributions) {
    if (contribution.status !== "confirmed" || contribution.amount_cents <= 0) continue;
    const paidOn = isoDateInTimeZone(contribution.confirmed_at ?? contribution.created_at);
    if (!paidOn) continue;
    marks.push({ paidOn, amountCents: contribution.amount_cents });
  }
  return marks;
}
