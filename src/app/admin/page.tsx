import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CreditCard,
  Settings,
  BarChart3,
  Users,
  Gift,
  Package,
  Smartphone,
} from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { listRecentContributions } from "@/lib/wallet/queries";
import { ContributionList } from "@/components/wallet/contribution-list";
import { formatCentsBRL } from "@/lib/utils";
import { listQuitadasForPickup } from "@/lib/reservations/queries";
import { PickupQueue } from "@/components/reservations/pickup-queue";
import { listStores } from "@/lib/stores/queries";
import { getFinanceAggregates } from "@/lib/finance/queries";
import { STAT_GRID_4 } from "@/lib/admin/stat-value";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const [
    { contributions },
    { reservations: quitadas },
    { stores },
    { aggregates },
  ] = await Promise.all([
    listRecentContributions(10),
    listQuitadasForPickup({ limit: 12 }),
    listStores(),
    getFinanceAggregates(10),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Plataforma"
        title="Admin"
        description="Overview financeiro, gateways e config."
        size="xl"
      />

      <div className={STAT_GRID_4}>
        {[
          {
            label: "Aportes confirmados",
            value: formatCentsBRL(aggregates.confirmed_sum_cents),
          },
          {
            label: "Pendentes",
            value: String(aggregates.pending_count),
          },
          {
            label: "Aportes (lista)",
            value: formatCentsBRL(
              contributions
                .filter((c) => c.status === "confirmed")
                .reduce((s, c) => s + c.amount_cents, 0),
            ),
          },
          { label: "Lojas", value: String(stores.length) },
        ].map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <section id="reservas">
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Todas as reservas</h2>
            <p className="mt-1 text-[var(--ink-muted)]">
              Busca, filtros por status/loja, cancelar e confirmar retirada.
            </p>
          </div>
          <Link prefetch href="/admin/reservas">
            <Button variant="accent">Abrir reservas</Button>
          </Link>
        </Card>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Dashboards</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Acessos, cliques e aportes.
            </p>
          </div>
          <Link prefetch href="/admin/dashboards">
            <Button variant="outline" size="sm" leftIcon={<BarChart3 className="h-4 w-4" />}>
              Abrir
            </Button>
          </Link>
        </Card>
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Avaliação de usados</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Fila de ofertas de aparelhos usados como pagamento.
            </p>
          </div>
          <Link prefetch href="/admin/avaliacao-usados">
            <Button variant="outline" size="sm" leftIcon={<Smartphone className="h-4 w-4" />}>
              Abrir
            </Button>
          </Link>
        </Card>
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Clientes</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Perfis, papéis e reservas.
            </p>
          </div>
          <Link prefetch href="/admin/clientes">
            <Button variant="outline" size="sm" leftIcon={<Users className="h-4 w-4" />}>
              Abrir
            </Button>
          </Link>
        </Card>
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Produtos</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Catálogo, categorias e abas da landing.
            </p>
          </div>
          <Link prefetch href="/admin/produtos">
            <Button variant="outline" size="sm" leftIcon={<Package className="h-4 w-4" />}>
              Abrir
            </Button>
          </Link>
        </Card>
      </div>

      <section id="retiradas">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Prontas para retirada
          </h2>
          <Pill tone="accent">{quitadas.length}</Pill>
        </div>
        <PickupQueue reservations={quitadas} />
      </section>

      <section id="financeiro">
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Financeiro</h2>
            <p className="mt-1 text-[var(--ink-muted)]">
              Agregados de aportes confirmados/pendentes e lista recente.
            </p>
          </div>
          <Link prefetch href="/admin/financeiro">
            <Button variant="accent" leftIcon={<CreditCard className="h-4 w-4" />}>
              Abrir financeiro
            </Button>
          </Link>
        </Card>
        {contributions.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<CreditCard className="h-6 w-6" />}
              title="Sem aportes ainda"
              description="Aportes confirmados e pendentes aparecerão aqui."
            />
          </div>
        ) : (
          <Card className="mt-4">
            <ContributionList contributions={contributions} />
          </Card>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Configurações</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Status de gateways (env) e bônus de indicação.
            </p>
          </div>
          <Link prefetch href="/admin/config">
            <Button variant="outline" size="sm" leftIcon={<Settings className="h-4 w-4" />}>
              Abrir
            </Button>
          </Link>
        </Card>
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Indicações</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Lista leve de referrals.
            </p>
          </div>
          <Link prefetch href="/admin/indicacoes">
            <Button variant="outline" size="sm" leftIcon={<Gift className="h-4 w-4" />}>
              Abrir
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
