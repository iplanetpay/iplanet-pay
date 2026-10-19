import { ContributionCalendar } from "@/components/reservations/contribution-calendar";
import { Card } from "@/components/ui/card";
import { buildGoalSchedule } from "@/lib/goals/goal-calendar";
import {
  calendarToday,
  isContributionFrequency,
  isoDateInTimeZone,
} from "@/lib/reservations/contribution-plan";
import type { Contribution } from "@/lib/wallet/types";
import type { PaymentGoal } from "@/types/database";

export function ReservationGoalSection({
  productName,
  goal,
  contributions,
}: {
  reservationId: string;
  productId: string;
  productName: string;
  listPriceCents: number;
  contributedCents: number;
  canEdit: boolean;
  goal: PaymentGoal | null;
  contributions: Contribution[];
}) {
  const today = calendarToday();
  if (!goal) return null;

  if (isContributionFrequency(goal.frequency) && goal.plan_start_date) {
    try {
      const { calendar } = buildGoalSchedule({
        name: goal.name,
        amountCents: goal.amount_cents,
        startDate: goal.plan_start_date,
        targetDate: goal.target_date,
        frequency: goal.frequency,
        contributions: confirmedMarks(contributions),
        today,
      });
      return <ContributionCalendar {...calendar} paged today={today} />;
    } catch {
      return (
        <Card>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            {goal.name}
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            A meta está salva, mas o calendário não pôde ser montado.
          </p>
        </Card>
      );
    }
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)]">{goal.name}</h2>
      <p className="mt-2 text-sm text-[var(--ink-muted)]">
        Meta de {productName} cadastrada para {goal.target_date}.
      </p>
    </Card>
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
