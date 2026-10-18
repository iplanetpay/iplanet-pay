import { ContributionCalendar } from "@/components/reservations/contribution-calendar";
import { Card } from "@/components/ui/card";
import {
  calendarMarks,
  resolveContributionSlots,
  type InstallmentResolution,
} from "@/lib/goals/calendar-marks";
import { goalHealth } from "@/lib/goals/journey";
import {
  applyEarlyPayments,
  buildContributionPlan,
  calendarToday,
  installmentCentsAt,
  isContributionFrequency,
  isoDateInTimeZone,
  type AppliedInstallment,
} from "@/lib/reservations/contribution-plan";
import type { Contribution } from "@/lib/wallet/types";
import type { PaymentGoal } from "@/types/database";

export function ReservationGoalSection({
  productName,
  listPriceCents,
  contributedCents,
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
      const plan = buildContributionPlan({
        targetCents: goal.amount_cents,
        contributedCents: 0,
        startDate: goal.plan_start_date,
        endDate: goal.target_date,
        frequency: goal.frequency,
      });
      const paid = confirmedMarks(contributions);
      const applied = applyEarlyPayments({
        installments: plan.dates.map((date, index) => ({
          dueDate: date,
          amountCents: installmentCentsAt(plan, index),
        })),
        contributions: paid,
      });
      const slots = resolveContributionSlots({
        dates: plan.dates,
        today,
        contributions: paid,
      }).map((slot, index) => settleSlot(slot, applied[index]));
      const nextOpen = applied.find((row) => !row.paid) ?? null;
      const progress =
        listPriceCents > 0
          ? Math.round((contributedCents / listPriceCents) * 100)
          : 0;
      return (
        <ContributionCalendar
          goalName={goal.name}
          frequency={goal.frequency}
          installmentCount={plan.installmentCount}
          heroCents={nextOpen ? nextOpen.dueCents : 0}
          heroLabel={
            nextOpen && nextOpen.dueCents < nextOpen.baseCents
              ? "Próximo aporte"
              : undefined
          }
          lastCents={applied.at(-1)?.dueCents ?? plan.lastInstallmentCents}
          deadline={goal.target_date}
          dues={applied.map((row, index) => ({
            date: row.dueDate,
            amountCents: row.paid ? row.baseCents : row.dueCents,
            status: slots[index]?.status ?? "upcoming",
            note: !row.paid && row.antecipado ? "Antecipado" : undefined,
          }))}
          marks={calendarMarks(slots)}
          paged
          today={today}
          health={goalHealth({
            today,
            dueDates: plan.dates,
            contributions: paid,
            progressPercent: progress,
          })}
        />
      );
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

function settleSlot(
  slot: InstallmentResolution,
  row: AppliedInstallment | undefined,
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
