import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { createClient } from "@/lib/supabase/server";
import { ticketsFromContributedCents } from "@/lib/raffle/utils";

export type RaffleRankingRow = {
  user_id: string;
  full_name: string;
  tickets: number;
  total_contributed_cents: number;
};

export { daysUntilNextRaffle, pickWeightedWinner, ticketsFromContributedCents } from "@/lib/raffle/utils";

export async function getUserTickets(userId: string): Promise<number> {
  if (USE_MOCK_AUTH || !userId) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("user_raffle_tickets", {
    p_user_id: userId,
  });
  return typeof data === "number" ? data : 0;
}

export async function getAporteRanking(limit = 50): Promise<{
  rows: RaffleRankingRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contributions")
    .select("user_id, amount_cents, status")
    .eq("status", "confirmed");

  if (error) return { rows: [], error: error.message };

  const byUser = new Map<string, number>();
  for (const row of data ?? []) {
    byUser.set(row.user_id, (byUser.get(row.user_id) ?? 0) + row.amount_cents);
  }

  const userIds = [...byUser.keys()];
  if (userIds.length === 0) return { rows: [], error: null };

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const nameMap = new Map<string, string>(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
      p.id,
      p.full_name ?? "Cliente",
    ]),
  );

  const rows = userIds
    .map((user_id) => {
      const total = byUser.get(user_id) ?? 0;
      return {
        user_id,
        full_name: nameMap.get(user_id) ?? "Cliente",
        total_contributed_cents: total,
        tickets: ticketsFromContributedCents(total),
      };
    })
    .filter((r) => r.tickets > 0)
    .sort((a, b) => b.tickets - a.tickets || b.total_contributed_cents - a.total_contributed_cents)
    .slice(0, limit);

  return { rows, error: null };
}
