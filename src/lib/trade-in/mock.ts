import { MOCK_USERS } from "@/lib/auth/mock";
import { mockAddPaidCents } from "@/lib/reservations/mock";
import type { TradeInDevice } from "@/lib/trade-in/devices";
import { isCounterOffer, isLiveOffer } from "@/lib/trade-in/offer-state";
import type { UsedDeviceOffer, UsedDeviceOfferWithProfile } from "@/lib/trade-in/types";

type MockResult = { ok: true } | { ok: false; error: string };

function offers(): Map<string, UsedDeviceOffer> {
  const scope = globalThis as typeof globalThis & {
    __iplanetMockTradeInOffers?: Map<string, UsedDeviceOffer>;
  };
  if (!scope.__iplanetMockTradeInOffers) {
    scope.__iplanetMockTradeInOffers = new Map();
  }
  return scope.__iplanetMockTradeInOffers;
}

function nowIso() {
  return new Date().toISOString();
}

export function mockListOffersForReservation(
  reservationId: string,
  userId: string,
): UsedDeviceOffer[] {
  return [...offers().values()]
    .filter((o) => o.reservation_id === reservationId && o.user_id === userId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function mockLiveOffers(reservationId: string, userId: string): UsedDeviceOffer[] {
  return mockListOffersForReservation(reservationId, userId).filter(isLiveOffer);
}

export function mockInsertOffers(input: {
  userId: string;
  reservationId: string;
  devices: Array<{ device: TradeInDevice; photoCount: number }>;
}): { ids: string[] } {
  const ids: string[] = [];
  for (const { device, photoCount } of input.devices) {
    const id = crypto.randomUUID();
    offers().set(id, {
      id,
      user_id: input.userId,
      reservation_id: input.reservationId,
      device_model: device.deviceModel,
      imei: device.imei,
      expected_value_cents: device.expectedCents,
      minimum_value_cents: device.minimumCents,
      maintenance_options: device.maintenanceOptions,
      liquid_exposure: device.liquidExposure,
      photo_paths: Array.from({ length: photoCount }, (_, i) => `mock/${id}/${i}.jpg`),
      battery_health_pct: device.battery.pct,
      battery_health_reason: device.battery.reason,
      status: "pending",
      admin_message: null,
      approved_value_cents: null,
      reviewed_at: null,
      created_at: nowIso(),
    });
    ids.push(id);
  }
  return { ids };
}

export function mockListOffersAdmin(filters: {
  status?: string;
  name?: string;
}): UsedDeviceOfferWithProfile[] {
  let rows: UsedDeviceOfferWithProfile[] = [...offers().values()].map((o) => {
    const profile = Object.values(MOCK_USERS).find((u) => u.id === o.user_id);
    return {
      ...o,
      client_name: profile?.full_name ?? null,
      client_phone: profile?.phone ?? null,
    };
  });
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (filters.status && filters.status !== "all") {
    rows = rows.filter((r) => r.status === filters.status);
  }
  if (filters.name?.trim()) {
    const needle = filters.name.trim().toLowerCase();
    rows = rows.filter((r) => (r.client_name ?? "").toLowerCase().includes(needle));
  }
  return rows;
}

export function mockGetOffer(id: string): UsedDeviceOffer | null {
  return offers().get(id) ?? null;
}

function approve(offer: UsedDeviceOffer, valueCents: number, message: string | null): MockResult {
  if (offer.status !== "pending") return { ok: false, error: "Solicitação já foi avaliada." };
  if (valueCents <= 0) return { ok: false, error: "Valor aprovado inválido." };
  offers().set(offer.id, {
    ...offer,
    status: "approved",
    approved_value_cents: valueCents,
    admin_message: message?.trim() || null,
    reviewed_at: nowIso(),
  });
  mockAddPaidCents(offer.reservation_id, valueCents);
  return { ok: true };
}

export function mockReviewOffer(input: {
  offerId: string;
  action: "approve" | "reject" | "counter";
  message: string;
  valueCents: number | null;
}): MockResult {
  const offer = offers().get(input.offerId);
  if (!offer) return { ok: false, error: "Solicitação não encontrada." };
  const message = input.message.trim();
  switch (input.action) {
    case "approve":
      return approve(offer, offer.expected_value_cents, message);
    case "reject":
      if (offer.status !== "pending") return { ok: false, error: "Solicitação já foi avaliada." };
      if (!message) return { ok: false, error: "Informe o motivo da recusa." };
      offers().set(offer.id, {
        ...offer,
        status: "rejected",
        admin_message: message,
        reviewed_at: nowIso(),
      });
      return { ok: true };
    case "counter":
      if (offer.status !== "pending") return { ok: false, error: "Solicitação já foi avaliada." };
      if (!message) return { ok: false, error: "A mensagem ao cliente é obrigatória." };
      if (!input.valueCents || input.valueCents <= 0) {
        return { ok: false, error: "Informe o valor proposto." };
      }
      offers().set(offer.id, {
        ...offer,
        admin_message: message,
        approved_value_cents: input.valueCents,
        reviewed_at: nowIso(),
      });
      return { ok: true };
    default: {
      const unhandled: never = input.action;
      return { ok: false, error: `Ação inválida: ${String(unhandled)}` };
    }
  }
}

export function mockRespondOffer(input: {
  offerId: string;
  userId: string;
  action: "accept" | "reject" | "resubmit" | "discard";
  expectedCents: number;
}): MockResult {
  const offer = offers().get(input.offerId);
  if (!offer || offer.user_id !== input.userId) {
    return { ok: false, error: "Avaliação não encontrada." };
  }
  switch (input.action) {
    case "accept":
      if (!isCounterOffer(offer) || !offer.approved_value_cents) {
        return { ok: false, error: "Não há contra-proposta para aceitar." };
      }
      return approve(offer, offer.approved_value_cents, offer.admin_message);
    case "reject":
      if (offer.status !== "pending") return { ok: false, error: "Solicitação já foi avaliada." };
      offers().set(offer.id, { ...offer, status: "rejected" });
      return { ok: true };
    case "resubmit":
      if (offer.status !== "rejected") return { ok: false, error: "Só avaliações recusadas podem ser reenviadas." };
      if (input.expectedCents <= 0) return { ok: false, error: "Informe o novo valor." };
      offers().set(offer.id, {
        ...offer,
        status: "pending",
        expected_value_cents: input.expectedCents,
        minimum_value_cents: input.expectedCents,
        approved_value_cents: null,
        reviewed_at: null,
        admin_message: null,
      });
      return { ok: true };
    case "discard":
      return { ok: false, error: "Descartar crédito não está disponível no modo demo." };
    default: {
      const unhandled: never = input.action;
      return { ok: false, error: `Ação inválida: ${String(unhandled)}` };
    }
  }
}
