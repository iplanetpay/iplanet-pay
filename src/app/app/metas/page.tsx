import { PageHeader } from "@/components/ui/page-header";
import {
  MountainJourney,
  type TrailAporte,
} from "@/components/goals/mountain/mountain-journey";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveContributionSlots } from "@/lib/goals/calendar-marks";
import { goalHealth, type GoalHealth } from "@/lib/goals/journey";
import { listPaymentGoalsForUser } from "@/lib/goals/queries";
import { getReservationById } from "@/lib/reservations/queries";
import {
  buildContributionPlan,
  calendarToday,
  isContributionFrequency,
  isoDateInTimeZone,
} from "@/lib/reservations/contribution-plan";
import { listContributionsForReservation } from "@/lib/wallet/queries";
import type { Contribution } from "@/lib/wallet/types";

export const metadata = { title: "Metas" };

export default async function MetasPage() {
  const user = await getCurrentUser();
  const goals = user ? await listPaymentGoalsForUser(user.id) : [];
  const goal =
    goals.find(
      (item) =>
        item.status === "active" &&
        item.reservation_id &&
        isContributionFrequency(item.frequency) &&
        item.plan_start_date,
    ) ?? null;

  let trail: {
    goalName: string;
    productName: string;
    health: GoalHealth;
    progressPercent: number;
    points: TrailAporte[];
  } | null = null;

  if (
    goal?.reservation_id &&
    isContributionFrequency(goal.frequency) &&
    goal.plan_start_date
  ) {
    const [{ reservation }, { contributions }] = await Promise.all([
      getReservationById(goal.reservation_id),
      listContributionsForReservation(goal.reservation_id),
    ]);
    if (reservation) {
      try {
        const plan = buildContributionPlan({
          targetCents: goal.amount_cents,
          contributedCents: 0,
          startDate: goal.plan_start_date,
          endDate: goal.target_date,
          frequency: goal.frequency,
        });
        const paid = confirmedMarks(contributions);
        const today = calendarToday();
        const slots = resolveContributionSlots({
          dates: plan.dates,
          today,
          contributions: paid,
        });
        const progress =
          reservation.list_price_cents > 0
            ? Math.round((reservation.amount_paid_cents / reservation.list_price_cents) * 100)
            : 0;
        trail = {
          goalName: goal.name,
          productName: reservation.product?.name ?? "Reserva",
          health: goalHealth({
            today,
            dueDates: plan.dates,
            contributions: paid,
            progressPercent: progress,
          }),
          progressPercent: progress,
          points: slots.map((slot) => ({
            dueDate: slot.dueDate,
            status: slot.status,
          })),
        };
      } catch {
        trail = null;
      }
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Jornada"
        title="Metas"
        description="A subida até o topo, com um ponto de corda para cada aporte."
      />
      <MountainJourney trail={trail} />
    </div>
  );
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
