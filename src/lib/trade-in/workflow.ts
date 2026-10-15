import { tryCreateServiceClient } from "@/lib/supabase/admin";
import type { UsedDeviceOffer } from "@/lib/trade-in/types";
import {
  isDiscardedOffer,
  isExpiredOffer,
  tradeInVisual,
} from "@/lib/trade-in/offer-state";

export {
  isCounterOffer,
  isDiscardedOffer,
  isExpiredOffer,
  tradeInExpiresAt,
  tradeInVisual,
  TRADE_IN_VALID_DAYS,
} from "@/lib/trade-in/offer-state";

export async function syncTradeInExpiry(input: {
  offer: UsedDeviceOffer;
  amountPaidCents: number;
  listPriceCents: number;
  reservationStatus: string;
}): Promise<void> {
  const visual = tradeInVisual(input.offer);
  if (!visual.expired || isExpiredOffer(input.offer) || isDiscardedOffer(input.offer)) return;
  if (input.reservationStatus !== "ativa" && input.reservationStatus !== "quitada") return;
  const cash = Math.max(0, input.amountPaidCents - visual.creditCents);
  if (cash >= input.listPriceCents) return;

  const admin = tryCreateServiceClient();
  if (!admin) return;
  const nextPaid = Math.max(0, input.amountPaidCents - visual.creditCents);
  const previous = input.offer.admin_message ?? "";
  await admin
    .from("used_device_offers")
    .update({ admin_message: `EXPIRADA|${previous}` })
    .eq("id", input.offer.id);
  await admin
    .from("reservations")
    .update({
      amount_paid_cents: nextPaid,
      status: "ativa",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.offer.reservation_id);
}

export async function sendCounterOffer(input: {
  offerId: string;
  message: string;
  valueCents: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.message.trim()) return { ok: false, error: "A mensagem ao cliente é obrigatória." };
  if (input.valueCents <= 0) return { ok: false, error: "Informe o valor proposto." };
  const admin = tryCreateServiceClient();
  if (!admin) return { ok: false, error: "Serviço de avaliação indisponível." };
  const { error } = await admin
    .from("used_device_offers")
    .update({
      admin_message: input.message.trim(),
      approved_value_cents: input.valueCents,
      reviewed_at: new Date().toISOString(),
      status: "pending",
    })
    .eq("id", input.offerId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function discardTradeIn(input: {
  offer: UsedDeviceOffer;
  amountPaidCents: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isDiscardedOffer(input.offer)) return { ok: true };
  const admin = tryCreateServiceClient();
  if (!admin) return { ok: false, error: "Serviço de avaliação indisponível." };
  const credit = input.offer.approved_value_cents ?? 0;
  const alreadyRemoved = isExpiredOffer(input.offer);
  const nextPaid = alreadyRemoved
    ? input.amountPaidCents
    : Math.max(0, input.amountPaidCents - credit);
  const previous = (input.offer.admin_message ?? "").replace(/^(EXPIRADA\|)/, "");
  const { error } = await admin
    .from("used_device_offers")
    .update({ admin_message: `DESCARTADA|${previous}` })
    .eq("id", input.offer.id);
  if (error) return { ok: false, error: error.message };
  await admin
    .from("reservations")
    .update({
      amount_paid_cents: nextPaid,
      status: "ativa",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.offer.reservation_id);
  return { ok: true };
}

export async function resubmitTradeIn(input: {
  offerId: string;
  userId: string;
  expectedCents: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.expectedCents <= 0) return { ok: false, error: "Informe o novo valor." };
  const admin = tryCreateServiceClient();
  if (!admin) return { ok: false, error: "Serviço de avaliação indisponível." };
  const { error } = await admin
    .from("used_device_offers")
    .update({
      status: "pending",
      expected_value_cents: input.expectedCents,
      minimum_value_cents: input.expectedCents,
      approved_value_cents: null,
      reviewed_at: null,
      admin_message: null,
    })
    .eq("id", input.offerId)
    .eq("user_id", input.userId)
    .eq("status", "rejected");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
