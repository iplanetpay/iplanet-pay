import Link from "next/link";
import { Ticket, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUserRaffleBalance, daysUntilNextRaffle } from "@/lib/raffle/queries";
import { RAFFLE_MIN_PROGRESS_PCT } from "@/lib/raffle/utils";

export async function FichasIndicator({ userId }: { userId: string }) {
  const balance = await getUserRaffleBalance(userId);
  const tickets = balance?.tickets ?? 0;
  const days = daysUntilNextRaffle();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg-subtle)] px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
        <Ticket className="h-4 w-4 text-[var(--accent)]" />
        {tickets} {tickets === 1 ? "ficha" : "fichas"}
      </span>
      <span className="text-xs text-[var(--ink-muted)]">
        Sorteio em {days} {days === 1 ? "dia" : "dias"} (dia 1)
      </span>
      {balance?.eligible ? null : (
        <span className="text-xs text-[var(--ink-muted)]">
          · participe com {RAFFLE_MIN_PROGRESS_PCT}% aportado
        </span>
      )}
      <Link href="/app/ranking" prefetch>
        <Button type="button" variant="ghost" size="sm" leftIcon={<Trophy className="h-4 w-4" />}>
          Ranking
        </Button>
      </Link>
    </div>
  );
}
