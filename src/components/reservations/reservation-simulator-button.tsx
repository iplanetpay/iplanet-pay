"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ContributionSimulator } from "@/components/reservations/contribution-simulator";
import { Button } from "@/components/ui/button";
import type { ContributionFrequency } from "@/lib/reservations/contribution-plan";

export function ReservationSimulatorButton({
  today,
  goalName,
  initialName,
  initialStartDate,
  initialDate,
  initialFrequency,
  product,
  reservation,
}: {
  today: string;
  goalName: string | null;
  initialName: string;
  initialStartDate: string;
  initialDate: string;
  initialFrequency: ContributionFrequency;
  product: { id: string; name: string; listPriceCents: number };
  reservation: {
    id: string;
    productId: string;
    listPriceCents: number;
    contributedCents: number;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const label = goalName?.trim() ? goalName : "Simular aportes";

  return (
    <div>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="simular-aportes-titulo"
            className="relative z-10 flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-[var(--radius-card)] border border-[var(--line)] bg-white shadow-xl sm:rounded-[var(--radius-card)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <h2 id="simular-aportes-titulo" className="text-lg font-bold tracking-tight">
                  {label}
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  Simulação só deste produto.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)]"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ContributionSimulator
                embedded
                productLocked
                showIntro={false}
                products={[product]}
                reservation={reservation}
                today={today}
                initialName={initialName}
                initialStartDate={initialStartDate}
                initialDate={initialDate}
                initialFrequency={initialFrequency}
                onCreated={() => {
                  setOpen(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
