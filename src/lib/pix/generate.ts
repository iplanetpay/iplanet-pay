import { getCurrentUser } from "@/lib/auth/session";
import {
  generatePixMercadoPago,
  isPixGatewayConfigured,
} from "@/lib/pix/mercadopago";
import type { GeneratePixOutcome } from "@/lib/pix/types";
import { createContribution } from "@/lib/wallet/mutations";
import { mapWalletError } from "@/lib/wallet/errors";
import { MIN_CONTRIBUTION_CENTS } from "@/lib/wallet/types";

const GATEWAY_MISSING_PT =
  "Gateway Pix não configurado. O aporte foi criado como pendente, mas o QR Code não pôde ser gerado. Peça ao time para definir MERCADOPAGO_ACCESS_TOKEN.";

/**
 * Cria contribution pending + tenta Mercado Pago.
 * Sem token: retorna ok com gateway_configured=false (não inventa QR).
 */
async function assertAporteContract(params: {
  contractId: string;
  reservationId: string;
  userId: string;
}) {
  if (params.contractId === "mock-contract") return { ok: true as const };

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("aporte_contracts")
    .select("id, reservation_id, scrolled_to_end, contribution_id, user_id")
    .eq("id", params.contractId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false as const, error: "Contrato do aporte não encontrado." };
  }
  if (
    data.user_id !== params.userId ||
    data.reservation_id !== params.reservationId ||
    data.scrolled_to_end !== true ||
    data.contribution_id
  ) {
    return {
      ok: false as const,
      error: "Aceite o contrato do aporte para continuar.",
    };
  }
  return { ok: true as const };
}

async function linkAporteContract(params: {
  contractId: string;
  contributionId: string;
  userId: string;
}) {
  if (params.contractId === "mock-contract") return;
  const { tryCreateServiceClient } = await import("@/lib/supabase/admin");
  const { createClient } = await import("@/lib/supabase/server");
  const db = tryCreateServiceClient() ?? (await createClient());
  await db
    .from("aporte_contracts")
    .update({ contribution_id: params.contributionId })
    .eq("id", params.contractId)
    .eq("user_id", params.userId)
    .is("contribution_id", null);
}

export async function generatePixForReservation(params: {
  reservationId: string;
  amountCents: number;
  contractId?: string;
}): Promise<GeneratePixOutcome> {
  const { reservationId, amountCents, contractId } = params;
  if (!reservationId) return { ok: false, error: "Reserva inválida." };
  if (!Number.isFinite(amountCents) || amountCents < MIN_CONTRIBUTION_CENTS) {
    return { ok: false, error: "Valor mínimo de R$ 5,00 por aporte." };
  }
  if (!contractId) {
    return { ok: false, error: "Aceite o contrato do aporte para continuar." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre para continuar." };

  const { aporteBlockedForUser } = await import("@/lib/profile/identity-server");
  const blocked = await aporteBlockedForUser(user);
  if (blocked) return { ok: false, error: blocked };

  const contract = await assertAporteContract({
    contractId,
    reservationId,
    userId: user.id,
  });
  if (!contract.ok) return contract;

  const created = await createContribution(reservationId, amountCents);
  if (!created.ok) return { ok: false, error: created.error };

  await linkAporteContract({
    contractId,
    contributionId: created.contribution_id,
    userId: user.id,
  });

  if (!isPixGatewayConfigured()) {
    return {
      ok: true,
      contribution_id: created.contribution_id,
      amount_cents: created.amount_cents,
      gateway_configured: false,
      pix: null,
      error: GATEWAY_MISSING_PT,
    };
  }

  try {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    const notificationUrl = `${appUrl}/api/webhooks/pix`;

    const pix = await generatePixMercadoPago({
      amountCents: created.amount_cents,
      description: `Aporte iPlanet Pay · reserva ${reservationId.slice(0, 8)}`,
      payerEmail: user.email,
      contributionId: created.contribution_id,
      notificationUrl,
    });

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error: attachError } = await supabase.rpc(
      "set_own_contribution_pix",
      {
        p_contribution_id: created.contribution_id,
        p_provider: pix.provider,
        p_external_id: pix.external_id,
        p_qr_copy_paste: pix.qr_copy_paste,
        p_qr_base64: pix.qr_base64 || null,
      },
    );
    if (attachError) {
      return {
        ok: true,
        contribution_id: created.contribution_id,
        amount_cents: created.amount_cents,
        gateway_configured: true,
        pix: {
          copy_paste: pix.qr_copy_paste,
          qr_base64: pix.qr_base64,
          charge_id: pix.external_id,
          provider: pix.provider,
        },
      };
    }

    return {
      ok: true,
      contribution_id: created.contribution_id,
      amount_cents: created.amount_cents,
      gateway_configured: true,
      pix: {
        copy_paste: pix.qr_copy_paste,
        qr_base64: pix.qr_base64,
        charge_id: pix.external_id,
        provider: pix.provider,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao gerar Pix no gateway";
    return {
      ok: true,
      contribution_id: created.contribution_id,
      amount_cents: created.amount_cents,
      gateway_configured: false,
      pix: null,
      error: mapWalletError(message),
    };
  }
}
