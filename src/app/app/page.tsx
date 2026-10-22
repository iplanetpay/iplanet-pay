import Link from "next/link";
import { Calculator, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ActiveHeroCarousel,
  type ActiveHeroItem,
} from "@/components/reservations/active-hero-carousel";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyReservations } from "@/lib/reservations/queries";
import {
  productSubtitle,
  reservationProgress,
  reservationRemainingCents,
} from "@/lib/reservations/types";
import { formatCentsBRL } from "@/lib/utils";
import { ReferralBonusCard } from "@/components/referrals/referral-bonus-card";

export const metadata = { title: "Início" };

export default async function ClienteHomePage() {
  const user = await getCurrentUser();
  const { reservations, error } = user
    ? await listMyReservations(user.id)
    : { reservations: [], error: null };

  const active = reservations.filter((r) => r.status === "ativa");
  const heroItems: ActiveHeroItem[] = active.map((hero) => ({
    id: hero.id,
    title: hero.product?.name ?? "Reserva",
    subtitle: productSubtitle(hero.product),
    priceLabel: `${formatCentsBRL(reservationRemainingCents(hero))} restantes`,
    imageUrl: hero.product?.image_url ?? null,
    progress: reservationProgress(hero),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sua reserva"
        title="Continue no seu ritmo"
        description="Acompanhe o aporte, pague com Pix e explore o catálogo."
        size="lg"
      />

      {user && (user.referral_bonus_balance_cents ?? 0) > 0 ? (
        <ReferralBonusCard
          balanceCents={user.referral_bonus_balance_cents ?? 0}
          activeReservations={active.map((r) => ({
            id: r.id,
            label: r.product?.name ?? `Reserva ${r.id.slice(0, 8)}`,
          }))}
        />
      ) : null}

      {error ? (
        <EmptyState
          icon={<Smartphone className="h-6 w-6" />}
          title="Não foi possível carregar"
          description={error}
        />
      ) : heroItems.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="h-6 w-6" />}
          title="Nenhuma reserva ativa"
          description="Escolha um iPhone no catálogo e gere o aporte Pix na reserva."
          action={
            <Link prefetch href="/app/catalogo">
              <Button variant="accent" leftIcon={<Smartphone className="h-4 w-4" />}>
                Ver catálogo
              </Button>
            </Link>
          }
        />
      ) : (
        <ActiveHeroCarousel items={heroItems} />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Minhas reservas</h2>
        <Link
          href="/app/reservas"
          className="text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Ver todas →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <Pill tone="lavender">Atalho</Pill>
          <h3 className="mt-3 text-2xl font-bold tracking-tight">Catálogo</h3>
          <p className="mt-2 text-[var(--ink-muted)]">
            Veja modelos disponíveis para nova reserva.
          </p>
          <Link prefetch href="/app/catalogo" className="mt-5 inline-block">
            <Button variant="outline" leftIcon={<Smartphone className="h-4 w-4" />}>
              Abrir catálogo
            </Button>
          </Link>
        </Card>
        <Card>
          <Pill tone="lavender">Ranking</Pill>
          <h3 className="mt-3 text-2xl font-bold tracking-tight">Fichas & posição</h3>
          <p className="mt-2 text-[var(--ink-muted)]">
            Acompanhe o ranking de aportes e suas fichas para o sorteio.
          </p>
          <Link prefetch href="/app/ranking" className="mt-5 inline-block">
            <Button variant="outline">Ver ranking →</Button>
          </Link>
        </Card>
        <Card>
          <Pill tone="accent">Wallet</Pill>
          <h3 className="mt-3 text-2xl font-bold tracking-tight">Saldo & Pix</h3>
          <p className="mt-2 text-[var(--ink-muted)]">
            Veja aportes Pix confirmados e o extrato da Wallet.
          </p>
          <Link prefetch href="/app/carteira" className="mt-5 inline-block">
            <Button variant="ghost">Ir para a Wallet →</Button>
          </Link>
        </Card>
        <Card>
          <Pill tone="lavender">Simulador</Pill>
          <h3 className="mt-3 text-2xl font-bold tracking-tight">Simulador de aportes</h3>
          <p className="mt-2 text-[var(--ink-muted)]">
            Calcule o valor de cada aporte e crie a meta do produto.
          </p>
          <Link prefetch href="/app/simulador" className="mt-5 inline-block">
            <Button variant="outline" leftIcon={<Calculator className="h-4 w-4" />}>
              Abrir simulador
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
