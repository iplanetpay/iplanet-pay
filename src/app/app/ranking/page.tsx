import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { getCurrentUser } from "@/lib/auth/session";
import { getAporteRanking, getUserRaffleBalance, daysUntilNextRaffle } from "@/lib/raffle/queries";
import { RAFFLE_ELIGIBILITY_MESSAGE } from "@/lib/raffle/utils";
import { formatCentsBRL } from "@/lib/utils";

export const metadata = { title: "Ranking de aportes" };

export default async function RankingPage() {
  const user = await getCurrentUser();
  const { rows, error } = await getAporteRanking(100);
  const myBalance = user ? await getUserRaffleBalance(user.id) : null;
  const myTickets = myBalance?.tickets ?? 0;
  const myIndex = user ? rows.findIndex((r) => r.user_id === user.id) : -1;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Consórcio iPlanet"
        title="Ranking de aportes"
        description={`Próximo sorteio em ${daysUntilNextRaffle()} dias (todo dia 1). Cada R$ 100 aportados = 1 ficha.`}
      />

      <Card className="border-[var(--accent)]/30 bg-[var(--bg-subtle)] text-sm text-[var(--ink)]">
        {RAFFLE_ELIGIBILITY_MESSAGE}
      </Card>

      {user ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--ink-muted)]">Sua posição</p>
            <p className="text-2xl font-bold">
              {myIndex >= 0 ? `#${myIndex + 1}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--ink-muted)]">Suas fichas</p>
            <p className="text-2xl font-bold text-[var(--accent)]">{myTickets}</p>
            {myBalance?.eligible ? null : (
              <p className="text-xs text-[var(--ink-muted)]">Ainda fora do sorteio</p>
            )}
          </div>
        </Card>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : (
        <Card className="divide-y divide-[var(--line)] p-0">
          {rows.map((row, i) => (
            <div
              key={row.user_id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-lg font-bold text-[var(--ink-muted)]">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">
                    {row.full_name}
                    {user?.id === row.user_id ? (
                      <Pill tone="accent" className="ml-2">
                        Você
                      </Pill>
                    ) : null}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {formatCentsBRL(row.total_contributed_cents)} aportados
                  </p>
                </div>
              </div>
              <Pill tone="lavender">{row.tickets} fichas</Pill>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
