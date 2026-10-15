import { getCurrentUser } from "@/lib/auth/session";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";

export async function requestWithdrawal(input: {
  reservation_id: string;
  pix_key: string;
  pix_key_type: string;
  holder_full_name: string;
  holder_cpf: string;
}): Promise<{ ok: true; request_id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  if (user.role !== "cliente" && user.role !== "admin") {
    return { ok: false, error: "Somente cliente pode solicitar saque." };
  }
  if (USE_MOCK_AUTH) {
    return { ok: false, error: "Saque indisponível em modo demo." };
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_withdrawal", {
      p_reservation_id: input.reservation_id,
      p_pix_key: input.pix_key,
      p_pix_key_type: input.pix_key_type,
      p_holder_full_name: input.holder_full_name,
      p_holder_cpf: input.holder_cpf,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, request_id: data as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha ao solicitar saque",
    };
  }
}

function mercadoPagoToken(): string | undefined {
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ||
    undefined
  );
}

export function resolvePayoutStatusOnApprove(): {
  payout_status: "pending_gateway" | "queued";
  note: string;
} {
  if (mercadoPagoToken()) {
    return {
      payout_status: "queued",
      note: "Pix payout enfileirado (gateway configurado; envio automático stub).",
    };
  }
  return {
    payout_status: "pending_gateway",
    note: "Pix será enviado quando o gateway (Mercado Pago) estiver configurado.",
  };
}

export async function processWithdrawalAdmin(input: {
  requestId: string;
  action: "approve" | "reject";
  password: string;
  adminNotes?: string;
}): Promise<
  | {
      ok: true;
      payout_status?: string;
      refund_amount_cents?: number;
      reservation_id?: string;
    }
  | { ok: false; error: string; status?: number }
> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Somente admin.", status: 403 };
  }

  const expected =
    process.env.WITHDRAWAL_APPROVE_PASSWORD?.trim() || "1234";
  if (input.password !== expected) {
    return { ok: false, error: "Senha de confirmação incorreta.", status: 401 };
  }

  if (USE_MOCK_AUTH) {
    return { ok: false, error: "Indisponível em modo demo.", status: 400 };
  }

  const payout =
    input.action === "approve" ? resolvePayoutStatusOnApprove() : null;
  const notesParts = [
    input.adminNotes?.trim() || null,
    payout?.note ?? null,
  ].filter(Boolean);
  const notes = notesParts.length ? notesParts.join(" · ") : null;

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("process_withdrawal", {
      p_request_id: input.requestId,
      p_action: input.action,
      p_admin_notes: notes,
      p_payout_status: payout?.payout_status ?? null,
    });
    if (error) return { ok: false, error: error.message, status: 400 };

    const result = data as {
      ok?: boolean;
      refund_amount_cents?: number;
      reservation_id?: string;
      payout_status?: string;
    };

    if (input.action === "reject") {
      try {
        const { tryCreateServiceClient } = await import("@/lib/supabase/admin");
        const { creditWallet } = await import("@/lib/wallet/balance");
        const admin = tryCreateServiceClient();
        if (admin) {
          const { data: hold } = await admin
            .from("wallet_ledger")
            .select("user_id, amount_cents")
            .eq("memo", `carteira:saque-hold ${input.requestId}`)
            .maybeSingle();
          if (hold?.user_id && (hold.amount_cents ?? 0) < 0) {
            await creditWallet({
              userId: hold.user_id,
              amountCents: -hold.amount_cents,
              memo: `saque-estorno ${input.requestId}`,
            });
          }
        }
      } catch {
        /* o saque foi rejeitado mesmo se o estorno da carteira falhar */
      }
    }

    if (input.action === "approve") {
      try {
        const { notifyWithdrawalApproved } = await import(
          "@/lib/withdrawals/notify"
        );
        void notifyWithdrawalApproved(input.requestId);
      } catch {
        /* non-fatal */
      }
    }

    return {
      ok: true,
      payout_status: result?.payout_status ?? payout?.payout_status,
      refund_amount_cents: result?.refund_amount_cents,
      reservation_id: result?.reservation_id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha ao processar",
      status: 500,
    };
  }
}
