"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCentsBRL } from "@/lib/utils";
import {
  MAINTENANCE_OPTIONS,
  USED_DEVICE_STATUS_LABEL,
} from "@/lib/trade-in/constants";
import { batteryHealthLabel } from "@/lib/trade-in/devices";
import {
  isDiscardedOffer,
  isExpiredOffer,
  tradeInCreditSummary,
  tradeInDaysRemaining,
  tradeInExpiresAt,
} from "@/lib/trade-in/offer-state";
import type { UsedDeviceOffer } from "@/lib/trade-in/types";
import { TradeInClientActions } from "@/components/trade-in/trade-in-actions";

export function UsedDeviceOfferStatus({
  reservationId,
  offers,
  canSubmitNew,
}: {
  reservationId: string;
  offers: UsedDeviceOffer[];
  canSubmitNew: boolean;
}) {
  const offerHref = `/app/reserva/${reservationId}/oferecimento-usado`;

  if (offers.length === 0 && !canSubmitNew) return null;

  const summary = tradeInCreditSummary(offers);

  return (
    <div className="space-y-3 border-t border-[var(--line)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--ink)]">Usados como pagamento</h3>
        {canSubmitNew ? (
          <Link href={offerHref}>
            <Button
              type="button"
              variant="accent"
              size="sm"
              leftIcon={
                offers.length > 0 ? <Plus className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />
              }
            >
              {offers.length > 0 ? "Adicionar aparelho usado" : "Oferecer aparelho usado"}
            </Button>
          </Link>
        ) : null}
      </div>

      {offers.length > 0 ? (
        <>
          {summary.acceptedCount > 0 ? (
            <p className="text-sm font-semibold text-[var(--accent)]">
              Crédito total de usados: {formatCentsBRL(summary.activeCents)}
              <span className="font-normal text-[var(--ink-muted)]">
                {" "}
                · {summary.acceptedCount}{" "}
                {summary.acceptedCount === 1 ? "aparelho aceito" : "aparelhos aceitos"}
              </span>
            </p>
          ) : null}
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              offerHref={offerHref}
              canSubmitNew={canSubmitNew}
            />
          ))}
        </>
      ) : (
        <p className="text-sm text-[var(--ink-muted)]">
          Ofereça um ou mais aparelhos usados para abater do saldo da reserva após avaliação.
        </p>
      )}
    </div>
  );
}

function OfferCard({
  offer,
  offerHref,
  canSubmitNew,
}: {
  offer: UsedDeviceOffer;
  offerHref: string;
  canSubmitNew: boolean;
}) {
  const [expiryNotice, setExpiryNotice] = useState(false);
  const daysLeft = tradeInDaysRemaining(offer);
  const expiresAt = tradeInExpiresAt(offer);
  const expired = isExpiredOffer(offer) || daysLeft === 0;
  const staffMessage = clientFacingMessage(offer.admin_message);

  return (
    <Card className="space-y-2 bg-[var(--bg-subtle)] p-4 text-sm">
      <p className="font-semibold text-[var(--ink)]">
        {offer.device_model}
        <span className="font-normal text-[var(--ink-muted)]">
          {" "}
          · {USED_DEVICE_STATUS_LABEL[offer.status]}
        </span>
      </p>
      <p className="text-[var(--ink-muted)]">
        IMEI {offer.imei} · Bateria {batteryHealthLabel(offer)}
      </p>
      <p className="text-[var(--ink-muted)]">
        Solicitado em {new Date(offer.created_at).toLocaleString("pt-BR")}
      </p>
      <p className="text-[var(--ink-muted)]">
        Valor esperado {formatCentsBRL(offer.expected_value_cents)} · mínimo{" "}
        {formatCentsBRL(offer.minimum_value_cents)}
      </p>
      {offer.status === "approved" && offer.approved_value_cents && !isDiscardedOffer(offer) ? (
        <p className="font-semibold text-[var(--accent)]">
          Crédito aplicado: {formatCentsBRL(offer.approved_value_cents)}
        </p>
      ) : null}
      {daysLeft != null && !expired && expiresAt ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setExpiryNotice((open) => !open)}
            className="inline-flex items-center gap-2 rounded-full bg-[#fff6df] px-3 py-1 text-xs font-semibold text-[#9a6b00]"
          >
            Expira em {daysLeft} {daysLeft === 1 ? "dia" : "dias"} ·{" "}
            {expiresAt.toLocaleDateString("pt-BR")}
          </button>
          {expiryNotice ? (
            <p className="rounded-xl border border-[#f5d78a] bg-white px-3 py-2 text-[var(--ink)]">
              Caso não conclusão de 100% dos aportes, o aparelho deverá ser reavaliado.
            </p>
          ) : null}
        </div>
      ) : null}
      {staffMessage ? (
        <p className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)]">
          <span className="font-semibold">Mensagem da iPlanet: </span>
          {staffMessage}
        </p>
      ) : null}
      <TradeInClientActions offer={offer} />
      {offer.status === "rejected" && canSubmitNew ? (
        <Link href={offerHref}>
          <Button type="button" variant="accent" size="sm" fullWidth>
            Enviar nova solicitação
          </Button>
        </Link>
      ) : null}
      {expired && canSubmitNew ? (
        <Link href={`${offerHref}?reavaliar=1`}>
          <Button type="button" variant="accent" size="sm" fullWidth>
            Reavaliar
          </Button>
        </Link>
      ) : null}
    </Card>
  );
}

function clientFacingMessage(message: string | null): string | null {
  if (!message) return null;
  const text = message.replace(/^(EXPIRADA|DESCARTADA)\|/, "").trim();
  return text || null;
}

export function maintenanceLabels(ids: string[]): string {
  const map = new Map(MAINTENANCE_OPTIONS.map((o) => [o.id, o.label]));
  return ids.map((id) => map.get(id as (typeof MAINTENANCE_OPTIONS)[number]["id"]) ?? id).join(", ");
}
