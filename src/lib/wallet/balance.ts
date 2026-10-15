import { tryCreateServiceClient } from "@/lib/supabase/admin";

const PREFIX = "carteira:";

export async function getWalletBalanceCents(userId: string): Promise<number> {
  const admin = tryCreateServiceClient();
  if (!admin) return 0;
  const { data, error } = await admin
    .from("wallet_ledger")
    .select("amount_cents, memo")
    .eq("user_id", userId);
  if (error || !data) return 0;
  return data.reduce((sum, row) => {
    if (typeof row.memo === "string" && row.memo.startsWith(PREFIX)) {
      return sum + (row.amount_cents ?? 0);
    }
    return sum;
  }, 0);
}

export async function creditWallet(input: {
  userId: string;
  amountCents: number;
  memo: string;
  reservationId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.amountCents <= 0) return { ok: true };
  const admin = tryCreateServiceClient();
  if (!admin) return { ok: false, error: "Carteira indisponível no servidor." };
  const { error } = await admin.from("wallet_ledger").insert({
    user_id: input.userId,
    reservation_id: input.reservationId ?? null,
    contribution_id: null,
    entry_type: "ajuste",
    amount_cents: input.amountCents,
    memo: `${PREFIX}${input.memo}`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function debitWallet(input: {
  userId: string;
  amountCents: number;
  memo: string;
  reservationId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.amountCents <= 0) return { ok: false, error: "Valor inválido." };
  const balance = await getWalletBalanceCents(input.userId);
  if (balance < input.amountCents) {
    return { ok: false, error: "Saldo da carteira insuficiente." };
  }
  const admin = tryCreateServiceClient();
  if (!admin) return { ok: false, error: "Carteira indisponível no servidor." };
  const { error } = await admin.from("wallet_ledger").insert({
    user_id: input.userId,
    reservation_id: input.reservationId ?? null,
    contribution_id: null,
    entry_type: "aplicacao",
    amount_cents: -input.amountCents,
    memo: `${PREFIX}${input.memo}`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
