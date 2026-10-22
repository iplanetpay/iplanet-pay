import { getCurrentUser } from "@/lib/auth/session";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { confirmContributionAsWebhook } from "@/lib/pix/confirm";
import { decideSimulation, paymentSimulationEnabled } from "@/lib/pix/simulation-guard";

export type SimulateResult =
  | { ok: true; status: 200; contribution_id: string; already_confirmed: boolean; simulated: true }
  | { ok: false; status: 400 | 401 | 403 | 404 | 409 | 500; error: string };

/**
 * Confirma um Pix pendente como se o Mercado Pago tivesse aprovado.
 * Somente teste: exige ALLOW_PAYMENT_SIMULATION=true e que o aporte seja do usuário.
 * `paymentId`: id do pagamento no Mercado Pago. `pixId`: id do aporte (contribution_id).
 */
export async function simulatePixPayment(input: {
  paymentId?: string | null;
  pixId?: string | null;
}): Promise<SimulateResult> {
  const enabled = paymentSimulationEnabled();
  if (!enabled) return { ok: false, status: 404, error: "Not found" };

  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "Entre para continuar." };

  const paymentId = input.paymentId?.toString().trim() || null;
  const pixId = input.pixId?.toString().trim() || null;
  if (!paymentId && !pixId) {
    return { ok: false, status: 400, error: "Informe paymentId ou pixId." };
  }

  if (USE_MOCK_AUTH) {
    return {
      ok: true,
      status: 200,
      contribution_id: pixId ?? paymentId ?? "",
      already_confirmed: false,
      simulated: true,
    };
  }

  // Mesmo cliente (service role) que o webhook usa; nenhum privilégio a mais.
  const admin = tryCreateServiceClient();
  if (!admin) return { ok: false, status: 500, error: "Servidor sem acesso ao banco." };

  let row: { id: string; user_id: string; status: string } | null = null;
  if (pixId) {
    const { data } = await admin
      .from("contributions")
      .select("id, user_id, status")
      .eq("id", pixId)
      .maybeSingle();
    row = data;
  }
  if (!row && paymentId) {
    const { data } = await admin
      .from("contributions")
      .select("id, user_id, status")
      .eq("gateway_payment_id", paymentId)
      .maybeSingle();
    row = data;
    if (!row) {
      const { data: charge } = await admin
        .from("pix_charges")
        .select("contribution_id")
        .eq("external_id", paymentId)
        .maybeSingle();
      if (charge?.contribution_id) {
        const { data: c } = await admin
          .from("contributions")
          .select("id, user_id, status")
          .eq("id", charge.contribution_id)
          .maybeSingle();
        row = c;
      }
    }
  }

  const decision = decideSimulation({ enabled, userId: user.id, ownerId: row?.user_id });
  if (!decision.allow) return { ok: false, status: decision.status, error: decision.error };
  if (!row) return { ok: false, status: 403, error: "Este pagamento não é da sua conta." };

  if (row.status !== "pending" && row.status !== "confirmed") {
    return { ok: false, status: 409, error: "Este aporte não está aguardando pagamento." };
  }

  const log = async (result: string) => {
    console.info(
      `[payment-simulation] contribution=${row!.id} user=${user.id} ref=${paymentId ?? pixId} result=${result}`,
    );
    await admin
      .from("payment_simulation_log")
      .insert({ contribution_id: row!.id, actor_id: user.id, payment_ref: paymentId ?? pixId, result })
      .then(
        () => undefined,
        () => undefined,
      );
  };

  if (row.status === "pending") {
    await admin
      .from("contributions")
      .update({ simulated_at: new Date().toISOString(), simulated_by: user.id })
      .eq("id", row.id)
      .eq("status", "pending")
      .then(
        () => undefined,
        () => undefined,
      );
  }

  const confirmed = await confirmContributionAsWebhook(admin, row.id);
  if (!confirmed.ok) {
    await admin
      .from("contributions")
      .update({ simulated_at: null, simulated_by: null })
      .eq("id", row.id)
      .eq("status", "pending")
      .then(
        () => undefined,
        () => undefined,
      );
    await log(`error: ${confirmed.error}`);
    return { ok: false, status: 400, error: confirmed.error };
  }
  await log(confirmed.alreadyConfirmed ? "already_confirmed" : "confirmed");
  return {
    ok: true,
    status: 200,
    contribution_id: row.id,
    already_confirmed: confirmed.alreadyConfirmed,
    simulated: true,
  };
}
