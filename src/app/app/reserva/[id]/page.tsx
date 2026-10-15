import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { ReservationStatusPill } from "@/components/reservations/status-pill";
import { CancelReservationButton } from "@/components/reservations/cancel-button";
import { SwitchDeviceButton } from "@/components/reservations/switch-device-button";
import { ConfirmRetiradaButton } from "@/components/reservations/confirm-retirada-button";
import { GerarPixForm } from "@/components/pix/gerar-pix-form";
import { UsedDeviceOfferStatus } from "@/components/trade-in/used-device-offer-status";
import { TradeInClientActions } from "@/components/trade-in/trade-in-actions";
import { isDiscardedOffer, isExpiredOffer, tradeInVisual } from "@/lib/trade-in/offer-state";
import { syncTradeInExpiry } from "@/lib/trade-in/workflow";
import { getLatestUsedDeviceOfferForReservation } from "@/lib/trade-in/queries";
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
import { Package } from "lucide-react";
import { ProductImage } from "@/components/products/product-image";

export const metadata = { title: "Reserva" };

export default async function ReservaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
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

  const { contributions } = await listContributionsForReservation(id);
  const confirmedAportesCents = await getConfirmedAportesCents(id);
  const pickupRequest = await getLatestPickupRequest(id);
  const title = reservation.product?.name ?? "Reserva";
  const subtitle = productSubtitle(reservation.product, reservation.store);
  const isOwner = user?.id === reservation.user_id;
  const paidWithdrawal = isOwner
    ? await getPaidWithdrawalForReservation(id)
    : null;
  const loadedOffer =
    isOwner && user
      ? (await getLatestUsedDeviceOfferForReservation(id, user.id)).offer
      : null;
  let paidCents = reservation.amount_paid_cents;
  let usedDeviceOffer = loadedOffer;
  if (usedDeviceOffer && isOwner) {
    const before = tradeInVisual(usedDeviceOffer);
    if (before.expired && !isExpiredOffer(usedDeviceOffer) && !isDiscardedOffer(usedDeviceOffer)) {
      await syncTradeInExpiry({
        offer: usedDeviceOffer,
        amountPaidCents: paidCents,
        listPriceCents: reservation.list_price_cents,
        reservationStatus: reservation.status,
      });
      paidCents = Math.max(0, paidCents - before.creditCents);
      usedDeviceOffer = {
        ...usedDeviceOffer,
        admin_message: `EXPIRADA|${usedDeviceOffer.admin_message ?? ""}`,
      };
    }
  }
  const tradeVisual = tradeInVisual(usedDeviceOffer);
  const tradeCents = tradeVisual.discarded ? 0 : tradeVisual.creditCents;
  const cashCents =
    tradeVisual.expired || tradeVisual.discarded
      ? paidCents
      : Math.max(0, paidCents - tradeCents);
  const cashProgress = reservation.list_price_cents
    ? Math.max(0, Math.min(100, Math.round((cashCents / reservation.list_price_cents) * 100)))
    : 0;
  const tradeProgress = reservation.list_price_cents
    ? Math.max(0, Math.min(100, Math.round((tradeCents / reservation.list_price_cents) * 100)))
    : 0;
  const canOfferUsedDevice =
    isOwner &&
    reservation.status === "ativa" &&
    (!usedDeviceOffer ||
      usedDeviceOffer.status === "rejected" ||
      isDiscardedOffer(usedDeviceOffer) ||
      isExpiredOffer(usedDeviceOffer));
  const canCancel = ownerCanCancelReservation(isOwner, reservation.status, cashCents);
  const canRequestSaque =
    isOwner &&
    reservation.status === "ativa" &&
    confirmedAportesCents > 0;
  const canSwitchDevice =
    reservation.status === "ativa" &&
    (isOwner || user?.role === "staff" || user?.role === "admin");
  const effectiveRemaining = Math.max(
    0,
    reservation.list_price_cents - cashCents - (tradeVisual.expired ? 0 : tradeCents),
  );
  const effectiveProgress = cashProgress + (tradeVisual.expired ? 0 : tradeProgress);
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
              {reservation.store ? (
                <Pill tone="lavender">{reservation.store.name}</Pill>
              ) : null}
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
              Retirada / envio — {pickupStatusLabel(pickupRequest.status)}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {pickupRequest.mode === "store"
                ? `Compareça à ${storeName} com documento com foto.`
                : `Envio ${pickupRequest.shipping_method ?? ""} — frete ${formatCentsBRL(pickupRequest.freight_cents + pickupRequest.insurance_cents)}.`}
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


        <ProgressBar
          value={cashProgress}
          extra={tradeProgress}
          extraTone={tradeVisual.tone}
          label="Aportes"
        />
        <div className="grid gap-3 text-sm text-[var(--ink-muted)] sm:grid-cols-2">
          <p>Total: {formatCentsBRL(reservation.list_price_cents)}</p>
          <p>
            Pago: {formatCentsBRL(cashCents)}
            {tradeCents > 0 ? (
              <span className={tradeVisual.tone === "red" ? "font-semibold text-[#e11d48]" : "font-semibold text-[#e0a100]"}>
                {" "}+ {formatCentsBRL(tradeCents)}
              </span>
            ) : null}
          </p>
          <p>
            Restante:{" "}
            {formatCentsBRL(
              Math.max(
                0,
                reservation.list_price_cents -
                  cashCents -
                  (tradeVisual.expired ? 0 : tradeCents),
              ),
            )}
          </p>
          <p>
            Criada em{" "}
            {new Date(reservation.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>

        {canAportar ? (
          <GerarPixForm
            reservationId={reservation.id}
            remainingCents={effectiveRemaining}
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

        {isOwner && (canOfferUsedDevice || usedDeviceOffer) ? (
          <div className="space-y-3">
            <UsedDeviceOfferStatus
              reservationId={reservation.id}
              offer={usedDeviceOffer}
              canSubmitNew={canOfferUsedDevice}
            />
            {usedDeviceOffer ? (
              <TradeInClientActions offer={usedDeviceOffer} amountPaidCents={paidCents} />
            ) : null}
          </div>
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
              }
            : null
        }
        emptyLabel="Nenhum aporte nesta reserva ainda."
      />
    </div>
  );
}
