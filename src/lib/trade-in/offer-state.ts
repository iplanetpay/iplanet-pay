import type { UsedDeviceOffer } from "@/lib/trade-in/types";

const DAY_MS = 86_400_000;
export const TRADE_IN_VALID_DAYS = 90;

/** Approve credits the value the client informed. A counter-offer uses the value the admin types. */
export function tradeInDecisionValue(
  action: "approve" | "reject" | "counter",
  informedCents: number,
  proposedCents: number | null,
): number | null {
  if (action === "approve") return informedCents;
  if (action === "counter") return proposedCents;
  return null;
}

export function isCounterOffer(offer: UsedDeviceOffer): boolean {
  return (
    offer.status === "pending" &&
    Boolean(offer.reviewed_at) &&
    (offer.approved_value_cents ?? 0) > 0
  );
}

export function isDiscardedOffer(offer: UsedDeviceOffer): boolean {
  return (offer.admin_message ?? "").startsWith("DESCARTADA|");
}

export function isExpiredOffer(offer: UsedDeviceOffer): boolean {
  return (offer.admin_message ?? "").startsWith("EXPIRADA|");
}

export function tradeInExpiresAt(offer: UsedDeviceOffer): Date | null {
  if (offer.status !== "approved" || !offer.reviewed_at) return null;
  if (isDiscardedOffer(offer)) return null;
  return new Date(new Date(offer.reviewed_at).getTime() + TRADE_IN_VALID_DAYS * DAY_MS);
}

export function tradeInDaysRemaining(offer: UsedDeviceOffer, now = Date.now()): number | null {
  const expires = tradeInExpiresAt(offer);
  if (!expires) return null;
  return Math.max(0, Math.ceil((expires.getTime() - now) / DAY_MS));
}

export function tradeInVisual(offer: UsedDeviceOffer | null, now = Date.now()) {
  if (!offer || offer.status !== "approved" || !offer.approved_value_cents) {
    return { creditCents: 0, tone: "yellow" as const, expired: false, discarded: false };
  }
  if (isDiscardedOffer(offer)) {
    return { creditCents: 0, tone: "yellow" as const, expired: false, discarded: true };
  }
  const markedExpired = isExpiredOffer(offer);
  const expires = tradeInExpiresAt(offer);
  const past = Boolean(expires && expires.getTime() <= now);
  const expired = markedExpired || past;
  return {
    creditCents: offer.approved_value_cents,
    tone: expired ? ("red" as const) : ("yellow" as const),
    expired,
    discarded: false,
  };
}

/** Pending, or approved credit that was neither discarded nor marked expired. */
export function isLiveOffer(offer: UsedDeviceOffer): boolean {
  if (offer.status === "pending") return true;
  return offer.status === "approved" && !isDiscardedOffer(offer) && !isExpiredOffer(offer);
}

/** Approved within 90 days but not yet marked EXPIRADA (credit still in amount_paid_cents). */
export function needsExpirySync(offer: UsedDeviceOffer, now = Date.now()): boolean {
  return tradeInVisual(offer, now).expired && !isExpiredOffer(offer);
}

export type TradeInCreditSummary = {
  /** Sum of accepted devices still valid — counts toward the reservation. */
  activeCents: number;
  /** Accepted devices past the 90-day cycle. */
  expiredCents: number;
  /** Credits still included in reservations.amount_paid_cents. */
  inPaidCents: number;
  acceptedCount: number;
};

export function tradeInCreditSummary(
  offers: UsedDeviceOffer[],
  now = Date.now(),
): TradeInCreditSummary {
  const summary: TradeInCreditSummary = {
    activeCents: 0,
    expiredCents: 0,
    inPaidCents: 0,
    acceptedCount: 0,
  };
  for (const offer of offers) {
    const visual = tradeInVisual(offer, now);
    if (visual.discarded || visual.creditCents <= 0) continue;
    if (!isExpiredOffer(offer)) summary.inPaidCents += visual.creditCents;
    if (visual.expired) {
      summary.expiredCents += visual.creditCents;
    } else {
      summary.activeCents += visual.creditCents;
      summary.acceptedCount += 1;
    }
  }
  return summary;
}

/** Cash part of amount_paid_cents once trade-in credits are taken out. */
export function tradeInCashCents(amountPaidCents: number, offers: UsedDeviceOffer[], now = Date.now()) {
  return Math.max(0, amountPaidCents - tradeInCreditSummary(offers, now).inPaidCents);
}

/** Tons usados no detalhe da reserva para o crédito de usado (iOS usa os mesmos hex). */
export const TRADE_IN_YELLOW = "#e0a100";
export const TRADE_IN_EXPIRED_RED = "#e11d48";

/**
 * Fatias do anel de progresso: aportes em dinheiro (azul) + crédito de usado avaliado (amarelo).
 * Cada fatia é arredondada e limitada; a soma nunca passa de 100.
 */
export function tradeInProgressSegments(listPriceCents: number, cashCents: number, tradeCents: number) {
  if (!listPriceCents) return { cashPct: 0, tradePct: 0 };
  const pct = (v: number) => Math.max(0, Math.min(100, Math.round((v / listPriceCents) * 100)));
  const cashPct = pct(cashCents);
  const tradePct = Math.min(100 - cashPct, pct(tradeCents));
  return { cashPct, tradePct };
}
