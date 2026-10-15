import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { ContributionList } from "@/components/wallet/contribution-list";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyReservations } from "@/lib/reservations/queries";
import { getWalletBalanceCents } from "@/lib/wallet/balance";
import { WalletActions } from "@/components/wallet/wallet-actions";
import { listMyContributions, listMyLedger } from "@/lib/wallet/queries";
import {
  LEDGER_ENTRY_LABEL,
  type WalletEntryType,
} from "@/lib/wallet/types";
import { formatCentsBRL } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata = { title: "Carteira" };

export default async function CarteiraPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const [{ contributions }, { entries }, balanceCents, { reservations }] = await Promise.all([
    listMyContributions(user.id),
    listMyLedger(user.id),
    getWalletBalanceCents(user.id),
    listMyReservations(user.id),
  ]);

  const confirmedCents = contributions
    .filter((c) => c.status === "confirmed")
    .reduce((sum, c) => sum + c.amount_cents, 0);
  const pendingCents = contributions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + c.amount_cents, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        showBack
        eyebrow="Financeiro"
        title="Carteira"
        description="Extrato de aportes, saldo livre e saque."
      />

      <Card>
        <p className="text-sm text-[var(--ink-muted)]">Saldo livre</p>
        <p className="mt-2 text-3xl font-bold tracking-tight">{formatCentsBRL(balanceCents)}</p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Entra aqui quando uma reserva é cancelada.
        </p>
      </Card>
      <WalletActions balanceCents={balanceCents} reservations={reservations} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-[var(--ink-muted)]">Confirmados</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">
            {formatCentsBRL(confirmedCents)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--ink-muted)]">Pendentes</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">
            {formatCentsBRL(pendingCents)}
          </p>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">Aportes</h2>
          <Pill tone="accent">{contributions.length}</Pill>
        </div>
        {contributions.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Nenhum aporte ainda"
            description="Gere um Pix em uma reserva ativa para ver o histórico aqui."
          />
        ) : (
          <ContributionList contributions={contributions} />
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">Extrato (ledger)</h2>
          <Pill>{entries.length}</Pill>
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            Lançamentos aparecem quando um aporte é confirmado (webhook ou
            staff).
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-semibold">
                    {LEDGER_ENTRY_LABEL[e.entry_type as WalletEntryType] ??
                      e.entry_type}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                    {e.memo ? ` · ${e.memo}` : ""}
                  </p>
                </div>
                <p
                  className={`font-semibold ${
                    e.amount_cents >= 0
                      ? "text-[var(--success, #0a7)]"
                      : "text-[var(--danger)]"
                  }`}
                >
                  {e.amount_cents >= 0 ? "+" : ""}
                  {formatCentsBRL(e.amount_cents)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
