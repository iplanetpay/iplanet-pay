import { getAppSettings } from "@/lib/settings/queries";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import {
  parseFeeConfig,
  splitWithdrawal,
  type WithdrawalFeeConfig,
  type WithdrawalSplit,
} from "./fee-window";

export type { WithdrawalFeeConfig };

export async function getWithdrawalFeeConfig(): Promise<WithdrawalFeeConfig> {
  if (USE_MOCK_AUTH) return parseFeeConfig({});
  const { settings } = await getAppSettings(["withdrawal_fee_pct", "withdrawal_full_refund_days"]);
  return parseFeeConfig(settings);
}

/** Prévia do saque de reserva. Lê os aportes com o cliente do usuário (RLS). */
export async function previewReservationWithdrawal(
  reservationId: string,
  userId: string,
): Promise<{ ok: true; split: WithdrawalSplit } | { ok: false; error: string }> {
  const cfg = await getWithdrawalFeeConfig();
  if (USE_MOCK_AUTH) {
    const now = Date.now();
    return {
      ok: true,
      split: splitWithdrawal({
        ...cfg,
        items: [
          { amountCents: 100_000, confirmedAt: new Date(now - 20 * 86_400_000) },
          { amountCents: 50_000, confirmedAt: new Date(now - 2 * 86_400_000) },
        ],
      }),
    };
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contributions")
    .select("amount_cents, confirmed_at, created_at")
    .eq("reservation_id", reservationId)
    .eq("user_id", userId)
    .eq("status", "confirmed");
  if (error) return { ok: false, error: error.message };
  const items = (data ?? []).map((c) => ({
    amountCents: Number(c.amount_cents ?? 0),
    confirmedAt: (c.confirmed_at as string | null) ?? (c.created_at as string | null),
  }));
  return { ok: true, split: splitWithdrawal({ ...cfg, items }) };
}

/**
 * Prévia do saque da carteira: créditos lançados na carteira há até
 * `windowDays` dias voltam integralmente; o resto paga a taxa.
 */
export async function previewWalletWithdrawal(
  userId: string,
  amountCents: number,
): Promise<WithdrawalSplit> {
  const cfg = await getWithdrawalFeeConfig();
  const admin = tryCreateServiceClient();
  let items: { amountCents: number; confirmedAt: string | null }[] = [];
  if (admin) {
    const { data } = await admin
      .from("wallet_ledger")
      .select("amount_cents, memo, created_at")
      .eq("user_id", userId)
      .gt("amount_cents", 0)
      .like("memo", "carteira:%");
    items = (data ?? []).map((r) => ({
      amountCents: Number(r.amount_cents ?? 0),
      confirmedAt: (r.created_at as string | null) ?? null,
    }));
  }
  return splitWithdrawal({ ...cfg, items, amountCents });
}
