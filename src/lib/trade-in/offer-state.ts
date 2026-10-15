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
