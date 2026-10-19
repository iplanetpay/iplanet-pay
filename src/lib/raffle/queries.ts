import type { SupabaseClient } from "@supabase/supabase-js";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { mockLatestDraw, mockRaffleSource, mockResets } from "@/lib/raffle/mock";
import {
  activeTicketReset,
  computeRaffleBalances,
  raffleDrawPool,
  raffleResetState,
  type RaffleBalance,
  type RaffleContribution,
  type RaffleReservation,
  type RaffleResetState,
  type RaffleTicketBaseline,
  type RaffleTicketReset,
} from "@/lib/raffle/utils";

export type RaffleRankingRow = {
  user_id: string;
  full_name: string;
  tickets: number;
  total_contributed_cents: number;
};

export type RaffleAdminResetInfo = {
  id: string;
  createdAt: string;
  usersCount: number;
  totalTickets: number;
};

export type RaffleAdminState = {
  latestDraw: { id: string; winnerName: string | null; drawnAt: string } | null;
  activeReset: RaffleAdminResetInfo | null;
  state: RaffleResetState;
};

export {
  daysUntilNextRaffle,
  pickWeightedWinner,
  ticketsFromContributedCents,
} from "@/lib/raffle/utils";

type ResetRow = {
  id: string;
  draw_id: string | null;
  snapshot: RaffleTicketBaseline | null;
  users_count: number;
  total_tickets: number;
  created_at: string;
  reverted_at: string | null;
};

type LoadedResets = {
  resets: RaffleTicketReset[];
  info: Map<string, RaffleAdminResetInfo>;
};

/** Ranking and fichas read every client's aportes, so prefer the service role. */
export async function raffleClient(): Promise<SupabaseClient> {
  return tryCreateServiceClient() ?? ((await createClient()) as unknown as SupabaseClient);
}

async function loadResets(client: SupabaseClient): Promise<LoadedResets> {
  const { data, error } = await client
    .from("raffle_ticket_resets")
    .select("id, draw_id, snapshot, users_count, total_tickets, created_at, reverted_at")
    .order("created_at", { ascending: false })
    .limit(24);
  // Before migration 032 is applied the table is missing: fichas stay un-offset.
  if (error || !data) return { resets: [], info: new Map() };
  const rows = data as ResetRow[];
  return {
    resets: rows.map((r) => ({
      id: r.id,
      drawId: r.draw_id,
      snapshot: r.snapshot ?? {},
      createdAt: r.created_at,
      revertedAt: r.reverted_at,
    })),
    info: new Map(
      rows.map((r) => [
        r.id,
        { id: r.id, createdAt: r.created_at, usersCount: r.users_count, totalTickets: r.total_tickets },
      ]),
    ),
  };
}

function mockLoadedResets(): LoadedResets {
  const records = mockResets();
  return {
    resets: records,
    info: new Map(
      records.map((r) => [
        r.id,
        { id: r.id, createdAt: r.createdAt, usersCount: r.usersCount, totalTickets: r.totalTickets },
      ]),
    ),
  };
}

export async function loadRaffleBalances(userId?: string): Promise<{
  balances: RaffleBalance[];
  names: Map<string, string>;
  error: string | null;
}> {
  if (USE_MOCK_AUTH) {
    const { contributions, reservations, names } = mockRaffleSource();
    const baseline = activeTicketReset(mockResets())?.snapshot ?? {};
    const balances = computeRaffleBalances({ contributions, reservations, baseline });
    return {
      balances: userId ? balances.filter((b) => b.userId === userId) : balances,
      names,
      error: null,
    };
  }

  try {
    const client = await raffleClient();
    let contributionsQuery = client
      .from("contributions")
      .select("user_id, reservation_id, amount_cents")
      .eq("status", "confirmed");
    let reservationsQuery = client.from("reservations").select("id, list_price_cents");
    if (userId) {
      contributionsQuery = contributionsQuery.eq("user_id", userId);
      reservationsQuery = reservationsQuery.eq("user_id", userId);
    }

    const [contributionsRes, reservationsRes, { resets }] = await Promise.all([
      contributionsQuery,
      reservationsQuery,
      loadResets(client),
    ]);
    if (contributionsRes.error) {
      return { balances: [], names: new Map(), error: contributionsRes.error.message };
    }
    if (reservationsRes.error) {
      return { balances: [], names: new Map(), error: reservationsRes.error.message };
    }

    const contributions: RaffleContribution[] = (contributionsRes.data ?? []).map(
      (c: { user_id: string; reservation_id: string; amount_cents: number }) => ({
        userId: c.user_id,
        reservationId: c.reservation_id,
        amountCents: c.amount_cents,
      }),
    );
    const reservations: RaffleReservation[] = (reservationsRes.data ?? []).map(
      (r: { id: string; list_price_cents: number }) => ({
        id: r.id,
        listPriceCents: r.list_price_cents,
      }),
    );
    const baseline = activeTicketReset(resets)?.snapshot ?? {};
    const balances = computeRaffleBalances({ contributions, reservations, baseline });

    const userIds = balances.map((b) => b.userId);
    const names = new Map<string, string>();
    if (!userId && userIds.length > 0) {
      const { data: profiles } = await client
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
        names.set(p.id, p.full_name ?? "Cliente");
      }
    }

    return { balances, names, error: null };
  } catch (e) {
    return {
      balances: [],
      names: new Map(),
      error: e instanceof Error ? e.message : "Falha ao carregar fichas",
    };
  }
}

export async function getUserRaffleBalance(userId: string): Promise<RaffleBalance | null> {
  if (!userId) return null;
  const { balances } = await loadRaffleBalances(userId);
  return balances.find((b) => b.userId === userId) ?? null;
}

export async function getUserTickets(userId: string): Promise<number> {
  return (await getUserRaffleBalance(userId))?.tickets ?? 0;
}

export async function getAporteRanking(limit = 50): Promise<{
  rows: RaffleRankingRow[];
  error: string | null;
}> {
  const { balances, names, error } = await loadRaffleBalances();
  if (error) return { rows: [], error };

  const rows = raffleDrawPool(balances)
    .map((b) => ({
      user_id: b.userId,
      full_name: names.get(b.userId) ?? "Cliente",
      total_contributed_cents: b.contributedCents,
      tickets: b.tickets,
    }))
    .sort((a, b) => b.tickets - a.tickets || b.total_contributed_cents - a.total_contributed_cents)
    .slice(0, limit);

  return { rows, error: null };
}

export async function getRaffleAdminState(): Promise<RaffleAdminState> {
  if (USE_MOCK_AUTH) {
    const draw = mockLatestDraw();
    const { resets, info } = mockLoadedResets();
    const active = activeTicketReset(resets);
    return {
      latestDraw: draw ? { id: draw.id, winnerName: draw.winnerName, drawnAt: draw.drawnAt } : null,
      activeReset: active ? (info.get(active.id) ?? null) : null,
      state: raffleResetState({ latestDrawId: draw?.id ?? null, activeReset: active }),
    };
  }

  try {
    const client = await raffleClient();
    const [{ data: draw }, { resets, info }] = await Promise.all([
      client
        .from("monthly_raffle_draws")
        .select("id, winner_name, drawn_at")
        .order("drawn_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadResets(client),
    ]);
    const latest = draw as { id: string; winner_name: string | null; drawn_at: string } | null;
    const active = activeTicketReset(resets);
    return {
      latestDraw: latest
        ? { id: latest.id, winnerName: latest.winner_name, drawnAt: latest.drawn_at }
        : null,
      activeReset: active ? (info.get(active.id) ?? null) : null,
      state: raffleResetState({ latestDrawId: latest?.id ?? null, activeReset: active }),
    };
  } catch {
    return { latestDraw: null, activeReset: null, state: { kind: "awaiting_draw" } };
  }
}
