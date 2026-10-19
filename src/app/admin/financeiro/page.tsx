import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ContributionList } from "@/components/wallet/contribution-list";
import { AdminSaquesPanel } from "@/components/withdrawals/admin-saques-panel";
import { getFinanceAggregates } from "@/lib/finance/queries";
import { listWithdrawalRequests } from "@/lib/withdrawals/queries";
import { formatCentsBRL } from "@/lib/utils";
import { CreditCard, ArrowLeft } from "lucide-react";
import { FinancialClosingPanel } from "@/components/finance/financial-closing-panel";
import { listClosings } from "@/lib/finance/closing";
import { STAT_GRID_4 } from "@/lib/admin/stat-value";

export const metadata = { title: "Financeiro" };

export default async function AdminFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ saque?: string }>;
}) {
  const sp = await searchParams;
  const [{ aggregates, error }, withdrawals, { closings }] = await Promise.all([
    getFinanceAggregates(40),
    listWithdrawalRequests(80),
    listClosings(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          eyebrow="Admin"
          title="Financeiro"
          description="Aportes reais e saques — sem GMV inventado."
          size="xl"
        />
        <Link href="/admin" className="shrink-0 self-start">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Voltar
          </Button>
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      {withdrawals.error ? (
        <p className="text-sm text-[var(--danger)]">{withdrawals.error}</p>
      ) : null}

      <div className={STAT_GRID_4}>
        {[
          {
            label: "Confirmados (soma)",
            value: formatCentsBRL(aggregates.confirmed_sum_cents),
          },
          {
            label: "Confirmados (qtd)",
            value: String(aggregates.confirmed_count),
          },
          {
            label: "Pendentes (qtd)",
            value: String(aggregates.pending_count),
          },
          {
            label: "Saques pendentes",
            value: `${withdrawals.pending_count} · ${formatCentsBRL(withdrawals.pending_refund_sum_cents)}`,
          },
        ].map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} maxRem={1.875} />
        ))}
      </div>

      <AdminSaquesPanel
        highlightId={sp.saque ?? null}
        items={withdrawals.items}
        pendingCount={withdrawals.pending_count}
        pendingRefundSumCents={withdrawals.pending_refund_sum_cents}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold tracking-tight">Por dia (28d)</h2>
          {aggregates.by_day.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-muted)]">Sem dados.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {aggregates.by_day.map((d) => (
                <li
                  key={d.day}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {new Date(d.day + "T12:00:00").toLocaleDateString("pt-BR")}{" "}
                    · {d.count}x
                  </span>
                  <span className="font-semibold">
                    {formatCentsBRL(d.confirmed_cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-bold tracking-tight">Por semana</h2>
          {aggregates.by_week.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-muted)]">Sem dados.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {aggregates.by_week.map((w) => (
                <li
                  key={w.week}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    Semana de{" "}
                    {new Date(w.week + "T12:00:00").toLocaleDateString("pt-BR")}{" "}
                    · {w.count}x
                  </span>
                  <span className="font-semibold">
                    {formatCentsBRL(w.confirmed_cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">
          Aportes recentes
        </h2>
        {aggregates.recent.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="Sem aportes ainda"
            description="Aportes confirmados e pendentes aparecerão aqui."
          />
        ) : (
          <Card>
            <ContributionList contributions={aggregates.recent} />
          </Card>
        )}
      </section>

      <FinancialClosingPanel closings={closings} />
    </div>
  );
}
