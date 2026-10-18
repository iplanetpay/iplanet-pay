import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { mockContributionsForReservation } from "@/lib/wallet/mock-contributions";
import {
  CONTRIBUTION_SELECT,
  type Contribution,
  type WalletLedgerEntry,
} from "@/lib/wallet/types";

export async function listContributionsForReservation(
  reservationId: string,
): Promise<{ contributions: Contribution[]; error: string | null }> {
  if (USE_MOCK_AUTH) {
    return { contributions: mockContributionsForReservation(reservationId), error: null };
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contributions")
      .select(CONTRIBUTION_SELECT)
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false });

    if (error) return { contributions: [], error: error.message };
    return { contributions: (data ?? []) as Contribution[], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao carregar aportes";
    return { contributions: [], error: message };
  }
}

export async function listMyContributions(
  userId: string,
  limit = 50,
): Promise<{ contributions: Contribution[]; error: string | null }> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contributions")
      .select(CONTRIBUTION_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { contributions: [], error: error.message };
    return { contributions: (data ?? []) as Contribution[], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao carregar aportes";
    return { contributions: [], error: message };
  }
}

export async function listMyLedger(
  userId: string,
  limit = 50,
): Promise<{ entries: WalletLedgerEntry[]; error: string | null }> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wallet_ledger")
      .select(
        "id, user_id, reservation_id, contribution_id, entry_type, amount_cents, memo, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { entries: [], error: error.message };
    return { entries: (data ?? []) as WalletLedgerEntry[], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao carregar extrato";
    return { entries: [], error: message };
  }
}

export async function listRecentContributions(
  limit = 20,
): Promise<{ contributions: Contribution[]; error: string | null }> {
  if (USE_MOCK_AUTH) {
    return { contributions: [], error: null };
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contributions")
      .select(CONTRIBUTION_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { contributions: [], error: error.message };
    return { contributions: (data ?? []) as Contribution[], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao carregar aportes";
    return { contributions: [], error: message };
  }
}
