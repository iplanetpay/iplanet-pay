import { Suspense } from "react";
import { MetasScreen } from "@/components/goals/climb/metas-screen";
import { PageHeader } from "@/components/ui/page-header";
import { climbGoalFromPlan } from "@/lib/goals/climb/adapter";
import type { GoalState } from "@/lib/goals/climb/types";
import { getCurrentUser } from "@/lib/auth/session";
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

  let climb: GoalState | null = null;
  let depositHref: string | null = null;

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
        const targetCents =
          reservation.list_price_cents > 0
            ? reservation.list_price_cents
            : goal.amount_cents;
        climb = climbGoalFromPlan({
          id: goal.id,
          name: goal.name,
          productName: reservation.product?.name ?? "Reserva",
          targetCents,
          savedCents: reservation.amount_paid_cents,
          today: calendarToday(),
          plan,
          contributions: confirmedMarks(contributions),
        });
        depositHref = `/app/reserva/${goal.reservation_id}`;
      } catch {
        climb = null;
      }
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Jornada"
        title="Metas"
        description="Cada aporte é um passo até o topo."
      />
      <Suspense fallback={null}>
        <MetasScreen goal={climb} depositHref={depositHref} />
      </Suspense>
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
