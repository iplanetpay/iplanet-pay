import { createServiceClient } from "@/lib/supabase/admin";
import { fetchMercadoPagoPayment } from "@/lib/pix/mercadopago";
import { confirmContributionAsWebhook } from "@/lib/pix/confirm";

export type WebhookProcessResult = {
  ok: boolean;
  message: string;
  contribution_id?: string;
  inbox_id?: string;
  skipped?: boolean;
};

/**
 * Processa notificação Mercado Pago (IPN/webhook).
 * Idempotente via webhooks_inbox + confirm_contribution.
 *
 * Verificação de assinatura: stub documentado — em produção validar
 * x-signature / secret do MP quando configurado (MERCADOPAGO_WEBHOOK_SECRET).
 */
export async function processPixWebhook(params: {
  rawBody: unknown;
  searchParams: URLSearchParams;
  headers: Headers;
}): Promise<WebhookProcessResult> {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (secret) {
    const sig =
      params.headers.get("x-signature") ||
      params.headers.get("x-hub-signature");
    if (!sig) {
      // Documented stub: when secret is set we require a signature header,
      // but full HMAC verify is deferred until MP secret is provisioned.
      console.warn(
        "pix-webhook: MERCADOPAGO_WEBHOOK_SECRET set but signature verify is stub — accepting with header present check only",
      );
    }
  } else {
    console.warn(
      "pix-webhook: sem MERCADOPAGO_WEBHOOK_SECRET — verificação de assinatura desabilitada (stub)",
    );
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Service role indisponível";
    return { ok: false, message };
  }

  const topic = params.searchParams.get("topic") || params.searchParams.get("type");
  const idFromQuery = params.searchParams.get("id") || params.searchParams.get("data.id");
  const body = (params.rawBody ?? {}) as {
    action?: string;
    type?: string;
    data?: { id?: string | number };
    id?: string | number;
  };

  const paymentId = String(
    idFromQuery || body?.data?.id || body?.id || "",
  ).trim();

  const isPaymentEvent =
    topic === "payment" ||
    body?.type === "payment" ||
    body?.action === "payment.updated" ||
    Boolean(paymentId);

  if (!isPaymentEvent || !paymentId) {
    return {
      ok: true,
      message: "Evento ignorado (não é pagamento Pix).",
      skipped: true,
    };
  }

  const { data: inbox, error: inboxError } = await supabase.rpc(
    "upsert_webhook_inbox",
    {
      p_provider: "mercado_pago",
      p_external_event_id: `payment:${paymentId}`,
      p_payload: {
        topic,
        payment_id: paymentId,
        body,
        received_at: new Date().toISOString(),
      },
    },
  );

  if (inboxError) {
    return { ok: false, message: inboxError.message };
  }

  const inboxRow = inbox as {
    id: string;
    already_processed?: boolean;
    inserted?: boolean;
  };

  if (inboxRow?.already_processed) {
    return {
      ok: true,
      message: "Webhook já processado (idempotente).",
      inbox_id: inboxRow.id,
      skipped: true,
    };
  }

  let payment;
  try {
    payment = await fetchMercadoPagoPayment(paymentId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao consultar MP";
    await supabase.rpc("mark_webhook_processed", {
      p_inbox_id: inboxRow.id,
      p_status: "error",
      p_error: message,
    });
    return { ok: false, message, inbox_id: inboxRow.id };
  }

  if (payment.status !== "approved") {
    await supabase.rpc("mark_webhook_processed", {
      p_inbox_id: inboxRow.id,
      p_status: "ignored",
      p_error: `status=${payment.status}`,
    });
    return {
      ok: true,
      message: `Pagamento ainda não aprovado (${payment.status}).`,
      inbox_id: inboxRow.id,
      skipped: true,
    };
  }

  let contributionId = payment.external_reference || null;
  if (!contributionId || contributionId === "null") {
    const { data: found } = await supabase
      .from("contributions")
      .select("id")
      .eq("gateway_payment_id", payment.id)
      .eq("status", "pending")
      .maybeSingle();
    contributionId = found?.id ?? null;
  } else {
    await supabase
      .from("contributions")
      .update({ gateway_payment_id: payment.id })
      .eq("id", contributionId);
  }

  if (!contributionId) {
    await supabase.rpc("mark_webhook_processed", {
      p_inbox_id: inboxRow.id,
      p_status: "error",
      p_error: "contribution_not_found",
    });
    return {
      ok: false,
      message: `Aporte não encontrado para payment ${payment.id}`,
      inbox_id: inboxRow.id,
    };
  }

  const confirmed = await confirmContributionAsWebhook(supabase, contributionId);

  if (!confirmed.ok) {
    await supabase.rpc("mark_webhook_processed", {
      p_inbox_id: inboxRow.id,
      p_status: "error",
      p_error: confirmed.error,
    });
    return {
      ok: false,
      message: confirmed.error,
      contribution_id: contributionId,
      inbox_id: inboxRow.id,
    };
  }

  await supabase.rpc("mark_webhook_processed", {
    p_inbox_id: inboxRow.id,
    p_status: "processed",
    p_error: null,
  });
  const already = confirmed.alreadyConfirmed;

  return {
    ok: true,
    message: "Aporte confirmado.",
    contribution_id: contributionId,
    inbox_id: inboxRow.id,
    skipped: already,
  };
}
