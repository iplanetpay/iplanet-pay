import Link from "next/link";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import {
  RAFFLE_ELIGIBILITY_MESSAGE,
  RAFFLE_MIN_PROGRESS_PCT,
  raffleEligibilityGapCents,
  reservationRaffleEligible,
} from "@/lib/raffle/utils";
import { formatCentsBRL } from "@/lib/utils";

export function ReservationRankingCard({
  contributedCents,
  listPriceCents,
  tickets,
}: {
  contributedCents: number;
  listPriceCents: number;
  tickets: number;
}) {
  const eligible = reservationRaffleEligible(contributedCents, listPriceCents);
  const gapCents = raffleEligibilityGapCents(contributedCents, listPriceCents);
  const pct = listPriceCents > 0 ? Math.floor((contributedCents / listPriceCents) * 1000) / 10 : 0;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Ranking</h2>
        <Pill tone={eligible ? "accent" : "lavender"}>
          {eligible ? "Participando do sorteio" : "Fora do sorteio"}
        </Pill>
      </div>
      <div className="grid gap-3 text-sm text-[var(--ink-muted)] sm:grid-cols-2">
        <p>
          Aportado nesta reserva: {pct.toLocaleString("pt-BR")}% (mínimo {RAFFLE_MIN_PROGRESS_PCT}%)
        </p>
        <p>
          Suas fichas: <span className="font-semibold text-[var(--accent)]">{tickets}</span>
        </p>
        {!eligible && gapCents > 0 ? (
          <p className="sm:col-span-2">
            Faltam {formatCentsBRL(gapCents)} em aportes para participar.
          </p>
        ) : null}
      </div>
      <p className="rounded-[var(--radius-card)] border border-[var(--accent)]/30 bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--ink)]">
        {RAFFLE_ELIGIBILITY_MESSAGE}
      </p>
      <Link href="/app/ranking" prefetch>
        <Button type="button" variant="outline" size="sm" leftIcon={<Trophy className="h-4 w-4" />}>
          Ver ranking
        </Button>
      </Link>
    </Card>
  );
}
