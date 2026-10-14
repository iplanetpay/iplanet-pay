import { WITHDRAWAL_SELECT, type WithdrawalRequest } from "./types";
import type { ReservationStatus } from "@/lib/reservations/types";

export interface WithdrawalWithDetails extends WithdrawalRequest {
  client_name: string | null;
  product_name: string | null;
}

export async function listWithdrawalRequests(limit = 80): Promise<{
  items: WithdrawalWithDetails[];
  pending_count: number;
  pending_refund_sum_cents: number;
  error: string | null;
}> {
  const empty = {
    items: [] as WithdrawalWithDetails[],
    pending_count: 0,
    pending_refund_sum_cents: 0,
    error: null as string | null,
  };
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select(WITHDRAWAL_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { ...empty, error: error.message };

    const rows = (data ?? []) as WithdrawalRequest[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const reservationIds = [...new Set(rows.map((r) => r.reservation_id))];

    const [{ data: profiles }, { data: reservations }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      reservationIds.length
        ? supabase
            .from("reservations")
            .select("id, product_id, products(name)")
            .in("id", reservationIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

    const nameByUser = new Map(
      (profiles ?? []).map((p: { id: string; full_name: string }) => [
        p.id,
        p.full_name,
      ]),
    );
    const productByRes = new Map<string, string>();
    for (const r of reservations ?? []) {
      const row = r as {
        id: string;
        products?: { name?: string } | { name?: string }[] | null;
      };
      const prod = Array.isArray(row.products) ? row.products[0] : row.products;
      productByRes.set(row.id, prod?.name ?? "—");
    }

    const items: WithdrawalWithDetails[] = rows.map((w) => ({
      ...w,
      client_name: nameByUser.get(w.user_id) ?? null,
      product_name: productByRes.get(w.reservation_id) ?? null,
    }));

    // pending first
    items.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return b.created_at.localeCompare(a.created_at);
    });

    const pending = items.filter((i) => i.status === "pending");
    return {
      items,
      pending_count: pending.length,
      pending_refund_sum_cents: pending.reduce(
        (s, i) => s + i.refund_amount_cents,
        0,
      ),
      error: null,
    };
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : "Falha ao carregar saques",
    };
  }
}

export async function getPaidWithdrawalForReservation(
  reservationId: string,
): Promise<WithdrawalRequest | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select(WITHDRAWAL_SELECT)
      .eq("reservation_id", reservationId)
      .eq("status", "approved")
      .eq("payout_status", "sent")
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as WithdrawalRequest;
  } catch {
    return null;
  }
}

export async function getConfirmedAportesCents(
  reservationId: string,
): Promise<number> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("contributions")
      .select("amount_cents")
      .eq("reservation_id", reservationId)
      .eq("status", "confirmed");
    return (data ?? []).reduce((s, c) => s + (c.amount_cents as number), 0);
  } catch {
    return 0;
  }
}

export function canRequestWithdrawal(status: ReservationStatus, paidCents: number) {
  return status === "ativa" && paidCents > 0;
}
