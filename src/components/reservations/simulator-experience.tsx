"use client";

import { useState } from "react";
import Link from "next/link";
import { ContributionCalendar } from "@/components/reservations/contribution-calendar";
import {
  ContributionSimulator,
  type SimulatorProduct,
} from "@/components/reservations/contribution-simulator";
import { Button } from "@/components/ui/button";
import { calendarMarks, resolveContributionSlots } from "@/lib/goals/calendar-marks";
import { goalHealth } from "@/lib/goals/journey";
import {
  installmentCentsAt,
  type ContributionFrequency,
  type ContributionPlan,
} from "@/lib/reservations/contribution-plan";

export function SimulatorExperience({
  products,
  today,
  initialProductKey,
}: {
  products: SimulatorProduct[];
  today: string;
  initialProductKey?: string;
}) {
  const [created, setCreated] = useState<{
    reservationId: string;
    name: string;
    frequency: ContributionFrequency;
    plan: ContributionPlan;
  } | null>(null);

  const slots = created
    ? resolveContributionSlots({
        dates: created.plan.dates,
        today,
        contributions: [],
      })
    : [];

  return (
    <div className="space-y-6">
      <ContributionSimulator
        products={products}
        today={today}
        initialProductKey={initialProductKey}
        onCreated={(result) => {
          setCreated({
            reservationId: result.reservationId,
            name: result.name,
            frequency: result.frequency,
            plan: result.plan,
          });
        }}
      />
      {created ? (
        <div className="space-y-4">
          <ContributionCalendar
            goalName={created.name}
            frequency={created.frequency}
            installmentCount={created.plan.installmentCount}
            heroCents={
              created.plan.amountPerInstallmentCents > 0
                ? created.plan.amountPerInstallmentCents
                : created.plan.lastInstallmentCents
            }
            lastCents={created.plan.lastInstallmentCents}
            deadline={created.plan.dates[created.plan.dates.length - 1] ?? ""}
            dues={created.plan.dates.map((date, index) => ({
              date,
              amountCents: installmentCentsAt(created.plan, index),
              status: slots[index]?.status ?? "upcoming",
            }))}
            marks={calendarMarks(slots)}
            health={goalHealth({
              today,
              dueDates: created.plan.dates,
              contributions: [],
              progressPercent: 0,
            })}
          />
          <Link href={`/app/reserva/${created.reservationId}`}>
            <Button variant="outline">Ver reserva</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
