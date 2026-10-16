import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { MOCK_USERS } from "@/lib/auth/mock";
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
  email: string | null;
  cpf: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  address_number: string | null;
  birth_date: string | null;
  referral_code: string | null;
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
    const clients: ClientListItem[] = Object.values(MOCK_USERS).map((u, i) => ({
      id: u.id,
      full_name: u.full_name,
      phone: u.phone ?? null,
      role: u.role,
      store_id: u.store_id ?? null,
      store_name: u.store_id ? "Mock Store" : null,
      created_at: new Date().toISOString(),
      reservation_count: i === 0 ? 1 : 0,
      total_paid_cents: i === 0 ? 50000 : 0,
    }));
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
    return { reservations: [], error: null };
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
  email: null,
  cpf: null,
  phone: null,
  city: null,
  state: null,
  address: null,
  address_number: null,
  birth_date: null,
  referral_code: null,
  referred_by_name: null,
  created_at: null,
  wallet_cents: 0,
};

export async function getClientDetail(
  userId: string,
): Promise<{ detail: ClientDetail; error: string | null }> {
  if (!userId) return { detail: EMPTY_DETAIL, error: "Usuário inválido." };
  if (USE_MOCK_AUTH) return { detail: EMPTY_DETAIL, error: null };

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const extended = await supabase
      .from("profiles")
      .select(
        "phone, created_at, referral_code, referred_by, cpf, city, state, address, address_number, birth_date",
      )
      .eq("id", userId)
      .maybeSingle();
    const fallback =
      extended.error && /column|schema cache/i.test(extended.error.message)
        ? await supabase
            .from("profiles")
            .select("phone, created_at, referral_code, referred_by")
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
        email,
        cpf: identity.cpf ? identity.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : null,
        phone: profile.phone ?? null,
        city: identity.city ?? null,
        state: identity.state ?? null,
        address: identity.address ?? null,
        address_number: identity.address_number ?? null,
        birth_date: identity.birth_date ?? null,
        referral_code: profile.referral_code ?? null,
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
