import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import {
  mockListOffersAdmin,
  mockListOffersForReservation,
} from "@/lib/trade-in/mock";
import type { UsedDeviceOffer, UsedDeviceOfferWithProfile } from "@/lib/trade-in/types";

const OFFER_SELECT = `
  id,
  user_id,
  reservation_id,
  device_model,
  imei,
  expected_value_cents,
  minimum_value_cents,
  maintenance_options,
  liquid_exposure,
  photo_paths,
  battery_health_pct,
  battery_health_reason,
  status,
  admin_message,
  approved_value_cents,
  reviewed_at,
  created_at
`;

async function attachProfilesToOffers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offers: UsedDeviceOffer[],
): Promise<UsedDeviceOfferWithProfile[]> {
  const userIds = [...new Set(offers.map((o) => o.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", userIds)
    : { data: [] as Array<{ id: string; full_name: string | null; phone: string | null }> };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return offers.map((o) => {
    const p = profileMap.get(o.user_id);
    return {
      ...o,
      client_name: p?.full_name ?? null,
      client_phone: p?.phone ?? null,
    };
  });
}

/** Every device the client offered on the reservation, oldest first. */
export async function listUsedDeviceOffersForReservation(
  reservationId: string,
  userId: string,
): Promise<{ offers: UsedDeviceOffer[]; error?: string }> {
  if (USE_MOCK_AUTH) {
    return { offers: mockListOffersForReservation(reservationId, userId) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("used_device_offers")
    .select(OFFER_SELECT)
    .eq("reservation_id", reservationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return { offers: [], error: error.message };
  }
  return { offers: (data ?? []) as UsedDeviceOffer[] };
}

export async function listUsedDeviceOffersAdmin(filters: {
  status?: string;
  name?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ rows: UsedDeviceOfferWithProfile[]; error?: string }> {
  if (USE_MOCK_AUTH) {
    return { rows: mockListOffersAdmin(filters) };
  }

  try {
    const supabase = await createClient();
    let q = supabase
      .from("used_device_offers")
      .select(OFFER_SELECT)
      .order("created_at", { ascending: false })
      .limit(200);

    if (filters.status && filters.status !== "all") {
      q = q.eq("status", filters.status);
    }
    if (filters.dateFrom) {
      q = q.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
    }
    if (filters.dateTo) {
      q = q.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
    }

    const { data, error } = await q;
    if (error) {
      return { rows: [], error: error.message };
    }

    let rows = await attachProfilesToOffers(supabase, (data ?? []) as UsedDeviceOffer[]);

    if (filters.name?.trim()) {
      const needle = filters.name.trim().toLowerCase();
      rows = rows.filter((r) => (r.client_name ?? "").toLowerCase().includes(needle));
    }

    return { rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao carregar ofertas";
    return { rows: [], error: message };
  }
}

export async function getUsedDeviceOfferByIdAdmin(
  id: string,
): Promise<{ offer: UsedDeviceOfferWithProfile | null; error?: string }> {
  if (USE_MOCK_AUTH) {
    const rows = mockListOffersAdmin({});
    const offer = rows.find((r) => r.id === id) ?? null;
    return { offer };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("used_device_offers")
      .select(OFFER_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return { offer: null, error: error?.message ?? "Não encontrado" };
    }

    const [withProfile] = await attachProfilesToOffers(supabase, [data as UsedDeviceOffer]);
    return { offer: withProfile ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao carregar oferta";
    return { offer: null, error: message };
  }
}

/** Privileged ops (review RPC) — service role when configured. */
export function getTradeInServiceClient() {
  return tryCreateServiceClient();
}
