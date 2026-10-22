import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ReservationStatusPill } from "@/components/reservations/status-pill";
import { CancelReservationButton } from "@/components/reservations/cancel-button";
import { SwitchDeviceButton } from "@/components/reservations/switch-device-button";
import { ReservationSimulatorButton } from "@/components/reservations/reservation-simulator-button";
import { ConfirmRetiradaButton } from "@/components/reservations/confirm-retirada-button";
import { parseAporteParam } from "@/lib/goals/aporte-prefill";
import { GerarPixForm } from "@/components/pix/gerar-pix-form";
import { paymentSimulationEnabled } from "@/lib/pix/simulation-guard";
import { UsedDeviceOfferStatus } from "@/components/trade-in/used-device-offer-status";
import { MAX_TRADE_IN_DEVICES } from "@/lib/trade-in/devices";
import {
  isLiveOffer,
  needsExpirySync,
  tradeInCashCents,
  tradeInCreditSummary,
  tradeInVisual,
  tradeInProgressSegments,
  TRADE_IN_EXPIRED_RED,
  TRADE_IN_YELLOW,
} from "@/lib/trade-in/offer-state";
import { syncTradeInExpiry } from "@/lib/trade-in/workflow";
import { listUsedDeviceOffersForReservation } from "@/lib/trade-in/queries";
import { ContributionHistoryPanel } from "@/components/wallet/contribution-history-panel";
import { SolicitarRetiradaWizard } from "@/components/pickup/solicitar-retirada-wizard";
import { getCurrentUser } from "@/lib/auth/session";
import { ownerCanCancelReservation } from "@/lib/reservations/cancel-policy";
import { getReservationById } from "@/lib/reservations/queries";
import { listCatalogProducts } from "@/lib/catalog/products";
import { listContributionsForReservation } from "@/lib/wallet/queries";
import {
  getConfirmedAportesCents,
  getPaidWithdrawalForReservation,
} from "@/lib/withdrawals/queries";
import {
  productSubtitle,
  shortReservationId,
} from "@/lib/reservations/types";
import { formatCentsBRL } from "@/lib/utils";
import {
  getLatestPickupRequest,
  pickupStatusLabel,
} from "@/lib/pickup/queries";
import { shippingMethodLabel } from "@/lib/pickup/fulfillment";
import { Package } from "lucide-react";
import { ProductImage } from "@/components/products/product-image";
import { ReservationGoalSection } from "@/components/reservations/reservation-goal-section";
import { getActiveGoalForReservation } from "@/lib/goals/queries";
import { ReservationRankingCard } from "@/components/raffle/reservation-ranking-card";
import { getUserRaffleBalance } from "@/lib/raffle/queries";
import {
  calendarToday,
  isContributionFrequency,
} from "@/lib/reservations/contribution-plan";

export const metadata = { title: "Reserva" };

export default async function ReservaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ aporte?: string | string[] }>;
}) {
  const { id } = await params;
  const aportePrefillCents = parseAporteParam((await searchParams)?.aporte);
  const user = await getCurrentUser();
  const { contributions } = await listContributionsForReservation(id);
  const { reservation, error } = await getReservationById(id);

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader
        showBack eyebrow="Reserva" title="Detalhe" />
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="Não foi possível carregar"
          description={error}
        />
      </div>
    );
  }

  if (!reservation) notFound();

  const confirmedAportesCents = await getConfirmedAportesCents(id);
  const pickupRequest = await getLatestPickupRequest(id);
  const title = reservation.product?.name ?? "Reserva";
  const subtitle = productSubtitle(reservation.product);
  const isOwner = user?.id === reservation.user_id;
  const paidWithdrawal = isOwner
    ? await getPaidWithdrawalForReservation(id)
    : null;
  let usedDeviceOffers =
    isOwner && user ? (await listUsedDeviceOffersForReservation(id, user.id)).offers : [];
  let paidCents = reservation.amount_paid_cents;
  for (const offer of usedDeviceOffers.filter((o) => needsExpirySync(o))) {
    await syncTradeInExpiry({
      offer,
      amountPaidCents: paidCents,
      cashCents: tradeInCashCents(paidCents, usedDeviceOffers),
      listPriceCents: reservation.list_price_cents,
      reservationStatus: reservation.status,
    });
    paidCents = Math.max(0, paidCents - tradeInVisual(offer).creditCents);
    usedDeviceOffers = usedDeviceOffers.map((o) =>
      o.id === offer.id ? { ...o, admin_message: `EXPIRADA|${o.admin_message ?? ""}` } : o,
    );
  }
  const tradeSummary = tradeInCreditSummary(usedDeviceOffers);
  const tradeCents = tradeSummary.activeCents;
  const expiredTradeCents = tradeSummary.expiredCents;
  const cashCents = tradeInCashCents(paidCents, usedDeviceOffers);
  const { cashPct: cashProgress, tradePct: tradeProgress } = tradeInProgressSegments(
    reservation.list_price_cents,
    cashCents,
    tradeCents,
  );
  const canOfferUsedDevice =
    isOwner &&
    reservation.status === "ativa" &&
    usedDeviceOffers.filter(isLiveOffer).length < MAX_TRADE_IN_DEVICES;
  const canCancel = ownerCanCancelReservation(isOwner, reservation.status, cashCents);
  const canRequestSaque =
    isOwner &&
    reservation.status === "ativa" &&
    confirmedAportesCents > 0;
  const canSwitchDevice =
    reservation.status === "ativa" &&
    (isOwner || user?.role === "staff" || user?.role === "admin");
  const effectiveRemaining = Math.max(0, reservation.list_price_cents - cashCents - tradeCents);
  const effectiveProgress = cashProgress + tradeProgress;
  const canAportar = isOwner && reservation.status === "ativa" && effectiveRemaining > 0;
  const canConfirmRetirada =
    reservation.status === "quitada" &&
    (user?.role === "staff" ||
      user?.role === "admin" ||
      user?.role === "parceiro");
  const storeName = reservation.store?.name ?? "a loja";
  const { products: catalogProducts } = canSwitchDevice
    ? await listCatalogProducts()
    : { products: [] };
  const goal = isOwner ? await getActiveGoalForReservation(reservation.id) : null;
  const raffleBalance = isOwner && user ? await getUserRaffleBalance(user.id) : null;
  const reservationConfirmedCents = contributions
    .filter((c) => c.status === "confirmed")
    .reduce((sum, c) => sum + c.amount_cents, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reserva"
        title={title}
        description={`#${shortReservationId(reservation.id)}`}
        actions={
          <Link href="/app">
            <Button variant="ghost" size="sm">
              ← Voltar
            </Button>
          </Link>
        }
      />

      <Card className="space-y-6">
        <div className="flex gap-4">
          <ProductImage
            src={reservation.product?.image_url}
            alt={title}
            size="lg"
            className="border border-[var(--line)]"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ReservationStatusPill status={reservation.status} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[var(--ink-muted)]">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {pickupRequest ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--accent)]/30 bg-[var(--bg-subtle)] px-4 py-3">
            <p className="font-semibold text-[var(--ink)]">
              Retirada / envio — {pickupStatusLabel(pickupRequest.status, pickupRequest.mode)}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {pickupRequest.mode === "store"
                ? pickupRequest.status === "ready_pickup"
                  ? `Compareça à ${storeName} com documento com foto.`
                  : `Estamos preparando seu aparelho na ${storeName}. Avisaremos quando estiver pronto.`
                : `Envio ${shippingMethodLabel(pickupRequest.shipping_method)} — frete ${formatCentsBRL(pickupRequest.freight_cents + pickupRequest.insurance_cents)}.`}
            </p>
          </div>
        ) : reservation.status === "quitada" ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-3">
            <p className="font-semibold text-[var(--ink)]">
              Pronto para retirada na loja {storeName}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Leve um documento com foto. A confirmação da retirada é feita pela
              equipe na loja.
            </p>
          </div>
        ) : null}

        {reservation.status === "retirada" ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-3">
            <p className="font-semibold text-[var(--ink)]">
              Aparelho retirado
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Esta reserva foi concluída com a retirada na loja.
            </p>
          </div>
        ) : null}

        {reservation.status === "trocada" ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-3">
            <p className="font-semibold text-[var(--ink)]">
              Reserva trocada
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              O saldo foi transferido para um novo aparelho. Veja em{" "}
              <Link href="/app/reservas" className="font-semibold text-[var(--accent)]">
                Minhas reservas
              </Link>
              .
            </p>
          </div>
        ) : null}
        {reservation.status === "saque_pendente" ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-3">
            <p className="font-semibold text-[var(--ink)]">
              Saque em análise
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Sua solicitação está pendente de aprovação no Financeiro. O Pix
              é efetuado em até 24h após a aprovação.
            </p>
          </div>
        ) : null}

        {reservation.status === "sacada" ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-3">
            <p className="font-semibold text-[var(--ink)]">
              Reserva sacada
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Esta reserva não aceita novos aportes.
            </p>
          </div>
        ) : null}


        <ProgressRing
          value={cashProgress}
          secondaryValue={tradeProgress}
          secondaryColor={TRADE_IN_YELLOW}
          label="Aportes"
        />
        <div className="grid gap-3 text-sm text-[var(--ink-muted)] sm:grid-cols-2">
          <p>Total: {formatCentsBRL(reservation.list_price_cents)}</p>
          <p>
            Pago: {formatCentsBRL(cashCents)}
            {tradeCents > 0 ? (
              <span className="font-semibold" style={{ color: TRADE_IN_YELLOW }}>
                {" "}+ {formatCentsBRL(tradeCents)}
              </span>
            ) : null}
            {expiredTradeCents > 0 ? (
              <span className="font-semibold" style={{ color: TRADE_IN_EXPIRED_RED }}>
                {" "}+ {formatCentsBRL(expiredTradeCents)}
              </span>
            ) : null}
          </p>
          <p>Restante: {formatCentsBRL(effectiveRemaining)}</p>
          <p>
            Criada em{" "}
            {new Date(reservation.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>

        {canAportar ? (
          <GerarPixForm
            reservationId={reservation.id}
            remainingCents={effectiveRemaining}
            prefillCents={aportePrefillCents}
            simulationEnabled={paymentSimulationEnabled()}
          />
        ) : (
          <p className="text-sm text-[var(--ink-muted)]">
            {reservation.status === "quitada"
              ? "Reserva quitada — aportes encerrados."
              : reservation.status === "retirada"
                ? "Reserva concluída."
                : reservation.status === "trocada"
                  ? "Esta reserva foi trocada — aportes encerrados aqui."
                  : reservation.status === "saque_pendente"
                    ? "Saque em análise — aportes pausados."
                    : reservation.status === "sacada"
                      ? "Reserva sacada — aportes encerrados."
                      : isOwner
                        ? "Não é possível gerar Pix nesta reserva."
                        : "Somente o dono da reserva pode gerar Pix."}
          </p>
        )}

        {isOwner && (canOfferUsedDevice || usedDeviceOffers.length > 0) ? (
          <UsedDeviceOfferStatus
            reservationId={reservation.id}
            offers={usedDeviceOffers}
            canSubmitNew={canOfferUsedDevice}
          />
        ) : null}

        {isOwner && reservation.status === "ativa" ? (
          <ReservationSimulatorButton
            today={calendarToday()}
            goalName={goal?.name ?? null}
            initialName={goal?.name ?? ""}
            initialStartDate={goal?.plan_start_date ?? ""}
            initialDate={goal?.target_date ?? ""}
            initialFrequency={
              goal && isContributionFrequency(goal.frequency) ? goal.frequency : "monthly"
            }
            product={{
              id: reservation.product_id,
              name: title,
              listPriceCents: reservation.list_price_cents,
            }}
            reservation={{
              id: reservation.id,
              productId: reservation.product_id,
              listPriceCents: reservation.list_price_cents,
              contributedCents: reservation.amount_paid_cents,
            }}
          />
        ) : null}

        {canSwitchDevice ? (
          <SwitchDeviceButton
            reservationId={reservation.id}
            currentProductId={reservation.product_id}
            storeId={reservation.store_id}
            amountPaidCents={reservation.amount_paid_cents}
            products={catalogProducts}
          />
        ) : null}


        {(effectiveProgress >= 70 || reservation.status === "quitada") &&
        isOwner &&
        !pickupRequest &&
        reservation.status !== "retirada" &&
        reservation.status !== "sacada" ? (
          <SolicitarRetiradaWizard
            reservationId={reservation.id}
            progressPct={Math.min(100, effectiveProgress)}
            storeName={storeName}
          />
        ) : null}

        {canCancel ? (
          <CancelReservationButton
            reservationId={reservation.id}
            amountPaidCents={cashCents}
            canCancel
          />
        ) : null}

        {canConfirmRetirada ? (
          <ConfirmRetiradaButton
            reservationId={reservation.id}
            productName={reservation.product?.name}
            size="md"
          />
        ) : null}
      </Card>

      {isOwner ? (
        <ReservationRankingCard
          contributedCents={reservationConfirmedCents}
          listPriceCents={reservation.list_price_cents}
          tickets={raffleBalance?.tickets ?? 0}
        />
      ) : null}

      {isOwner ? (
        <ReservationGoalSection
          reservationId={reservation.id}
          productId={reservation.product_id}
          productName={title}
          listPriceCents={reservation.list_price_cents}
          contributedCents={reservation.amount_paid_cents}
          canEdit={reservation.status === "ativa"}
          goal={goal}
          contributions={contributions}
        />
      ) : null}

      <ContributionHistoryPanel
        contributions={contributions}
        showSaque={canRequestSaque}
        reservationId={reservation.id}
        paidWithdrawal={
          paidWithdrawal
            ? {
                totalPaidCents: paidWithdrawal.total_paid_cents,
                feePct: paidWithdrawal.fee_percentage,
                feeAmountCents: paidWithdrawal.fee_amount_cents,
                refundAmountCents: paidWithdrawal.refund_amount_cents,
                fullRefundCents: paidWithdrawal.full_refund_cents,
                discountedCents: paidWithdrawal.discounted_cents,
              }
            : null
        }
        emptyLabel="Nenhum aporte nesta reserva ainda."
      />
    </div>
  );
}
