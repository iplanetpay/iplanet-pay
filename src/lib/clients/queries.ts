import { MOCK_USERS, USE_MOCK_AUTH } from "@/lib/auth/mock";
import {
  EMPTY_ACTIVITY,
  mergeReferredClients,
  type ClientActivity,
  type ClientTradeInRow,
  type ClientWithdrawalRow,
} from "@/lib/clients/activity";
import { mockClientProfile, mockClientProfiles, mockReferredBy } from "@/lib/clients/mock";
import { mockListMine } from "@/lib/reservations/mock";
import { mockListOffersAdmin } from "@/lib/trade-in/mock";
import { listContributionsForReservation } from "@/lib/wallet/queries";
import { mockListWithdrawals } from "@/lib/withdrawals/mock";
import type { ReferralStatus } from "@/lib/referrals/types";
import type { UsedDeviceOfferStatus } from "@/lib/trade-in/types";
import type { WithdrawalPayoutStatus, WithdrawalStatus } from "@/lib/withdrawals/types";
import type { ReservationStatus, Store } from "@/types/database";
import type { UserRole } from "@/types/auth";

export type ClientListItem = {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  store_id: string | null;
  store_name: string | null;
  created_at: string;
  reservation_count: number;
  total_paid_cents: number;
};

export type ClientContributionRow = {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  confirmed_at: string | null;
};

export type ClientReservationRow = {
  id: string;
  status: ReservationStatus;
  list_price_cents: number;
  amount_paid_cents: number;
  created_at: string;
  product_name: string | null;
  image_url: string | null;
  store_name: string | null;
  contributions: ClientContributionRow[];
};

export type ClientDetail = {
  id: string | null;
  full_name: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  address_number: string | null;
  birth_date: string | null;
  referral_code: string | null;
  referred_by_id: string | null;
  referred_by_name: string | null;
  created_at: string | null;
  wallet_cents: number;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

function asOne<T extends Record<string, unknown>>(
  value: T | T[] | null | undefined,
): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}


export async function searchClients(options?: {
  q?: string | null;
  limit?: number;
}): Promise<{ clients: ClientListItem[]; error: string | null }> {
  const q = (options?.q ?? "").trim();
  const limit = options?.limit ?? 100;

  if (USE_MOCK_AUTH) {
    const clients: ClientListItem[] = mockClientProfiles().map((p) => {
      const reservations = mockListMine(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        role: p.role,
        store_id: p.store_id,
        store_name: p.store_id ? "Mock Store" : null,
        created_at: p.created_at,
        reservation_count: reservations.length,
        total_paid_cents: reservations
          .filter((r) => r.status !== "cancelada" && r.status !== "trocada")
          .reduce((s, r) => s + r.amount_paid_cents, 0),
      };
    });
    const filtered = q
      ? clients.filter(
          (c) =>
            norm(c.full_name).includes(norm(q)) ||
            (c.phone ?? "").includes(q.replace(/\D/g, "")) ||
            (c.phone ?? "").includes(q),
        )
      : clients;
    return { clients: filtered.slice(0, limit), error: null };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    let profilesQuery = supabase
      .from("profiles")
      .select(
        "id, full_name, phone, role, store_id, created_at, store:stores ( id, name )",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (q) {
      // PostgREST or-filter for name/phone
      const safe = q.replace(/[%_,]/g, "");
      profilesQuery = profilesQuery.or(
        `full_name.ilike.%${safe}%,phone.ilike.%${safe}%`,
      );
    }

    const { data: profiles, error } = await profilesQuery;
    if (error) return { clients: [], error: error.message };

    const ids = (profiles ?? []).map((p) => p.id as string);
    const stats = new Map<string, { count: number; paid: number }>();

    if (ids.length > 0) {
      const { data: reservations, error: resErr } = await supabase
        .from("reservations")
        .select("user_id, amount_paid_cents, status")
        .in("user_id", ids);
      if (resErr) return { clients: [], error: resErr.message };
      for (const r of reservations ?? []) {
        const curr = stats.get(r.user_id) ?? { count: 0, paid: 0 };
        curr.count += 1;
        if (r.status !== "cancelada" && r.status !== "trocada") {
          curr.paid += r.amount_paid_cents ?? 0;
        }
        stats.set(r.user_id, curr);
      }
    }

    const clients: ClientListItem[] = (profiles ?? []).map((p) => {
      const store = asOne(
        p.store as { id: string; name: string } | { id: string; name: string }[] | null,
      );
      const st = stats.get(p.id) ?? { count: 0, paid: 0 };
      return {
        id: p.id,
        full_name: p.full_name || "Sem nome",
        phone: p.phone,
        role: p.role as UserRole,
        store_id: p.store_id,
        store_name: store?.name ?? null,
        created_at: p.created_at,
        reservation_count: st.count,
        total_paid_cents: st.paid,
      };
    });

    return { clients, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao buscar clientes";
    return { clients: [], error: message };
  }
}

export async function listClientReservations(
  userId: string,
): Promise<{ reservations: ClientReservationRow[]; error: string | null }> {
  if (!userId) return { reservations: [], error: "Usuário inválido." };

  if (USE_MOCK_AUTH) {
    const rows = await Promise.all(
      mockListMine(userId).map(async (r) => {
        const { contributions } = await listContributionsForReservation(r.id);
        return {
          id: r.id,
          status: r.status,
          list_price_cents: r.list_price_cents,
          amount_paid_cents: r.amount_paid_cents,
          created_at: r.created_at,
          product_name: r.product?.name ?? null,
          image_url: r.product?.image_url ?? null,
          store_name: r.store?.name ?? null,
          contributions: contributions.map((c) => ({
            id: c.id,
            amount_cents: c.amount_cents,
            status: c.status,
            created_at: c.created_at,
            confirmed_at: c.confirmed_at,
          })),
        };
      }),
    );
    return { reservations: rows, error: null };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .select(
        `
        id,
        status,
        list_price_cents,
        amount_paid_cents,
        created_at,
        product:products ( name, image_url ),
        store:stores ( name )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return { reservations: [], error: error.message };

    const reservationIds = (data ?? []).map((r) => r.id as string);
    const contributionsByReservation = new Map<string, ClientContributionRow[]>();
    if (reservationIds.length > 0) {
      const { data: contributions, error: contribError } = await supabase
        .from("contributions")
        .select("id, reservation_id, amount_cents, status, created_at, confirmed_at")
        .in("reservation_id", reservationIds)
        .order("created_at", { ascending: false });
      if (contribError) return { reservations: [], error: contribError.message };
      for (const row of contributions ?? []) {
        const list = contributionsByReservation.get(row.reservation_id) ?? [];
        list.push({
          id: row.id,
          amount_cents: row.amount_cents,
          status: row.status,
          created_at: row.created_at,
          confirmed_at: row.confirmed_at,
        });
        contributionsByReservation.set(row.reservation_id, list);
      }
    }

    const reservations: ClientReservationRow[] = (data ?? []).map((r) => {
      const product = asOne(
        r.product as
          | { name: string; image_url: string | null }
          | { name: string; image_url: string | null }[]
          | null,
      );
      const store = asOne(
        r.store as { name: string } | { name: string }[] | null,
      );
      return {
        id: r.id,
        status: r.status as ReservationStatus,
        list_price_cents: r.list_price_cents,
        amount_paid_cents: r.amount_paid_cents,
        created_at: r.created_at,
        product_name: product?.name ?? null,
        image_url: product?.image_url ?? null,
        store_name: store?.name ?? null,
        contributions: contributionsByReservation.get(r.id) ?? [],
      };
    });

    return { reservations, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao carregar reservas";
    return { reservations: [], error: message };
  }
}

const EMPTY_DETAIL: ClientDetail = {
  id: null,
  full_name: null,
  email: null,
  cpf: null,
  phone: null,
  city: null,
  state: null,
  address: null,
  address_number: null,
  birth_date: null,
  referral_code: null,
  referred_by_id: null,
  referred_by_name: null,
  created_at: null,
  wallet_cents: 0,
};

function formatCpfDigits(cpf: string | null | undefined) {
  return cpf ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : null;
}

function mockClientDetail(userId: string): { detail: ClientDetail; error: string | null } {
  const profile = mockClientProfile(userId);
  if (!profile) return { detail: EMPTY_DETAIL, error: "Cliente não encontrado." };
  const referrer = profile.referred_by ? mockClientProfile(profile.referred_by) : null;
  const email = Object.values(MOCK_USERS).find((u) => u.id === userId)?.email ?? null;
  return {
    detail: {
      ...EMPTY_DETAIL,
      id: profile.id,
      full_name: profile.full_name,
      email,
      cpf: formatCpfDigits(profile.cpf),
      phone: profile.phone,
      city: profile.city,
      state: profile.state,
      address: profile.address,
      address_number: profile.address_number,
      birth_date: profile.birth_date,
      referral_code: profile.referral_code,
      referred_by_id: referrer?.id ?? null,
      referred_by_name: referrer?.full_name ?? null,
      created_at: profile.created_at,
    },
    error: null,
  };
}

export async function getClientDetail(
  userId: string,
): Promise<{ detail: ClientDetail; error: string | null }> {
  if (!userId) return { detail: EMPTY_DETAIL, error: "Usuário inválido." };
  if (USE_MOCK_AUTH) return mockClientDetail(userId);

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const extended = await supabase
      .from("profiles")
      .select(
        "full_name, phone, created_at, referral_code, referred_by, cpf, city, state, address, address_number, birth_date",
      )
      .eq("id", userId)
      .maybeSingle();
    const fallback =
      extended.error && /column|schema cache/i.test(extended.error.message)
        ? await supabase
            .from("profiles")
            .select("full_name, phone, created_at, referral_code, referred_by")
            .eq("id", userId)
            .maybeSingle()
        : null;
    const profile = fallback?.data ?? extended.data;
    const error = fallback ? fallback.error : extended.error;
    if (error || !profile) return { detail: EMPTY_DETAIL, error: error?.message ?? "Cliente não encontrado." };
    const identity = profile as typeof profile & {
      cpf?: string | null;
      city?: string | null;
      state?: string | null;
      address?: string | null;
      address_number?: string | null;
      birth_date?: string | null;
    };

    let referredByName: string | null = null;
    if (profile?.referred_by) {
      const { data: referrer } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", profile.referred_by)
        .maybeSingle();
      referredByName = referrer?.full_name?.trim() || null;
    }

    let email: string | null = null;
    const { tryCreateServiceClient } = await import("@/lib/supabase/admin");
    const admin = tryCreateServiceClient();
    if (admin) {
      const { data } = await admin.auth.admin.getUserById(userId);
      email = data.user?.email ?? null;
    }

    const { getWalletBalanceCents } = await import("@/lib/wallet/balance");
    const walletCents = await getWalletBalanceCents(userId);

    return {
      detail: {
        ...EMPTY_DETAIL,
        id: userId,
        full_name: profile.full_name?.trim() || null,
        email,
        cpf: formatCpfDigits(identity.cpf),
        phone: profile.phone ?? null,
        city: identity.city ?? null,
        state: identity.state ?? null,
        address: identity.address ?? null,
        address_number: identity.address_number ?? null,
        birth_date: identity.birth_date ?? null,
        referral_code: profile.referral_code ?? null,
        referred_by_id: profile.referred_by ?? null,
        referred_by_name: referredByName,
        created_at: profile.created_at ?? null,
        wallet_cents: walletCents,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao carregar o cliente";
    return { detail: EMPTY_DETAIL, error: message };
  }
}

function mockClientActivity(userId: string): ClientActivity {
  return {
    referred: mergeReferredClients(
      mockReferredBy(userId),
      mockReferredBy(userId)
        .filter((p) => p.referral_status)
        .map((p) => ({
          referred_id: p.id,
          status: p.referral_status as ReferralStatus,
          created_at: p.created_at,
        })),
    ),
    trade_ins: mockListOffersAdmin({})
      .filter((o) => o.user_id === userId)
      .map((o) => ({
        id: o.id,
        device_model: o.device_model,
        status: o.status,
        expected_value_cents: o.expected_value_cents,
        approved_value_cents: o.approved_value_cents,
        created_at: o.created_at,
      })),
    withdrawals: mockListWithdrawals(userId).map((w) => ({
      id: w.id,
      status: w.status,
      payout_status: w.payout_status,
      refund_amount_cents: w.refund_amount_cents,
      product_name: w.product_name,
      created_at: w.created_at,
    })),
  };
}

/** Referrals, trade-in offers and withdrawals of one client; each part fails soft to an empty list. */
export async function getClientActivity(userId: string): Promise<ClientActivity> {
  if (!userId) return EMPTY_ACTIVITY;
  if (USE_MOCK_AUTH) return mockClientActivity(userId);

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const [profilesRes, referralsRes, offersRes, withdrawalsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .eq("referred_by", userId)
        .limit(100),
      supabase
        .from("referrals")
        .select("referred_id, status, created_at")
        .eq("referrer_id", userId)
        .limit(100),
      supabase
        .from("used_device_offers")
        .select("id, device_model, status, expected_value_cents, approved_value_cents, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("withdrawal_requests")
        .select("id, reservation_id, status, payout_status, refund_amount_cents, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const referredProfiles = (profilesRes.data ?? []) as Array<{
      id: string;
      full_name: string | null;
      created_at: string | null;
    }>;
    const referralRows = (referralsRes.data ?? []) as Array<{
      referred_id: string;
      status: ReferralStatus;
      created_at: string;
    }>;
    const known = new Set(referredProfiles.map((p) => p.id));
    const missing = referralRows.map((r) => r.referred_id).filter((id) => !known.has(id));
    const names: Record<string, string | null> = {};
    if (missing.length > 0) {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", missing);
      for (const p of data ?? []) names[p.id as string] = (p.full_name as string | null) ?? null;
    }

    const withdrawalRows = (withdrawalsRes.data ?? []) as Array<{
      id: string;
      reservation_id: string;
      status: WithdrawalStatus;
      payout_status: WithdrawalPayoutStatus;
      refund_amount_cents: number;
      created_at: string;
    }>;
    const productByReservation = new Map<string, string>();
    const reservationIds = [...new Set(withdrawalRows.map((w) => w.reservation_id))];
    if (reservationIds.length > 0) {
      const { data } = await supabase
        .from("reservations")
        .select("id, product:products ( name )")
        .in("id", reservationIds);
      for (const row of data ?? []) {
        const product = asOne(
          row.product as { name: string } | { name: string }[] | null,
        );
        if (product?.name) productByReservation.set(row.id as string, product.name);
      }
    }

    const tradeIns: ClientTradeInRow[] = (
      (offersRes.data ?? []) as Array<{
        id: string;
        device_model: string;
        status: UsedDeviceOfferStatus;
        expected_value_cents: number;
        approved_value_cents: number | null;
        created_at: string;
      }>
    ).map((o) => ({ ...o }));
    const withdrawals: ClientWithdrawalRow[] = withdrawalRows.map((w) => ({
      id: w.id,
      status: w.status,
      payout_status: w.payout_status,
      refund_amount_cents: w.refund_amount_cents,
      product_name: productByReservation.get(w.reservation_id) ?? null,
      created_at: w.created_at,
    }));

    return {
      referred: mergeReferredClients(referredProfiles, referralRows, names),
      trade_ins: tradeIns,
      withdrawals,
    };
  } catch {
    return EMPTY_ACTIVITY;
  }
}

export async function listStoresForAdmin(): Promise<{
  stores: Store[];
  error: string | null;
}> {
  if (USE_MOCK_AUTH) {
    return {
      stores: [
        {
          id: "store-itaim",
          name: "iPlanet Itaim Bibi",
          slug: "itaim-bibi",
          address: "Itaim Bibi",
          city: "São Paulo",
        },
        {
          id: "store-sc",
          name: "iPlanet São Caetano",
          slug: "sao-caetano",
          address: "Centro",
          city: "São Caetano do Sul",
        },
      ],
      error: null,
    };
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stores")
      .select("id, name, slug, address, city, created_at")
      .order("name");
    if (error) return { stores: [], error: error.message };
    return { stores: (data ?? []) as Store[], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao carregar lojas";
    return { stores: [], error: message };
  }
}
