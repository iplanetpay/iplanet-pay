/**
 * WhatsApp via Evolution API 2.3.7.
 * Sem EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE → só enfileira.
 *
 * POST {base}/message/sendText/{instance}
 * Header apikey. Corpo: { number, text }.
 */

export function whatsappConfigured(): boolean {
  return evolutionConfig() !== null;
}

type EvolutionConfig = {
  baseUrl: string;
  apiKey: string;
  instance: string;
};

function evolutionConfig(): EvolutionConfig | null {
  const baseUrl = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instance = process.env.EVOLUTION_INSTANCE?.trim();
  if (!baseUrl || !apiKey || !instance) return null;
  return { baseUrl, apiKey, instance };
}

export type EnqueueWhatsappInput = {
  to_phone: string;
  body: string;
  goal_id?: string | null;
  template_id?: string | null;
  media_url?: string | null;
  scheduled_at?: string | null;
};

export type EnqueueResult =
  | { ok: true; queue_id: string; sent: boolean; skipped_api: boolean }
  | { ok: false; error: string };

export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

export function renderTemplate(
  body: string,
  vars: Record<string, string>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

type QueueRow = {
  id: string;
  to_phone: string;
  body: string;
  media_url?: string | null;
};

function evolutionError(status: number, raw: string): string {
  try {
    const data = JSON.parse(raw) as {
      message?: string | string[];
      error?: { message?: string } | string;
      response?: { message?: string | string[] };
    };
    const nested =
      typeof data.error === "object" ? data.error?.message : data.error;
    const responseMessage = Array.isArray(data.response?.message)
      ? data.response.message.join(", ")
      : data.response?.message;
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;
    const text = nested || responseMessage || message;
    if (text) return String(text).slice(0, 500);
  } catch {
    // keep raw body
  }
  return (raw || `Evolution HTTP ${status}`).slice(0, 500);
}

function mediaKind(url: string): "image" | "video" | "audio" | "document" {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (/\.(png|jpe?g|webp|gif)$/.test(path)) return "image";
  if (/\.(mp4|mov|webm)$/.test(path)) return "video";
  if (/\.(mp3|ogg|wav|m4a|opus)$/.test(path)) return "audio";
  return "document";
}

async function postEvolution(
  cfg: EvolutionConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const instance = encodeURIComponent(cfg.instance);
  const res = await fetch(`${cfg.baseUrl}/message/${path}/${instance}`, {
    method: "POST",
    headers: {
      apikey: cfg.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: evolutionError(res.status, errText) };
  }
  return { ok: true };
}

async function sendEvolutionMessage(
  to: string,
  body: string,
  mediaUrl?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = evolutionConfig();
  if (!cfg) return { ok: false, error: "Evolution não configurada." };

  const media = mediaUrl?.trim();
  if (media) {
    const kind = mediaKind(media);
    if (kind === "audio") {
      return postEvolution(cfg, "sendWhatsAppAudio", {
        number: to,
        audio: media,
      });
    }
    const filename = media.split("?")[0]?.split("/").pop() || "arquivo";
    return postEvolution(cfg, "sendMedia", {
      number: to,
      mediatype: kind === "document" ? "document" : kind,
      media,
      caption: body,
      fileName: filename,
    });
  }

  return postEvolution(cfg, "sendText", {
    number: to,
    text: body,
  });
}

async function markQueue(
  queueId: string,
  patch: { status: "sent" | "failed" | "skipped"; error: string | null; sent_at?: string },
) {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  await admin.from("whatsapp_dispatch_queue").update(patch).eq("id", queueId);
}

async function deliverQueueRow(row: QueueRow): Promise<boolean> {
  const to = normalizePhone(row.to_phone);
  if (!whatsappConfigured()) {
    await markQueue(row.id, {
      status: "skipped",
      error: "Evolution não configurada",
      sent_at: new Date().toISOString(),
    });
    return false;
  }

  try {
    const sent = await sendEvolutionMessage(to, row.body, row.media_url);
    if (!sent.ok) {
      await markQueue(row.id, { status: "failed", error: sent.error });
      return false;
    }
    await markQueue(row.id, {
      status: "sent",
      error: null,
      sent_at: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    await markQueue(row.id, { status: "failed", error: message.slice(0, 500) });
    return false;
  }
}

/** Due pending rows. Used by the WhatsApp cron. */
export async function processDueWhatsappQueue(limit = 50): Promise<number> {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const now = new Date().toISOString();
  const { data } = await admin
    .from("whatsapp_dispatch_queue")
    .select("id, to_phone, body, media_url")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  let processed = 0;
  for (const row of data ?? []) {
    await deliverQueueRow(row);
    processed += 1;
  }
  return processed;
}

/** Persist to whatsapp_dispatch_queue and send now when the message is due. */
export async function enqueueWhatsapp(
  input: EnqueueWhatsappInput,
): Promise<EnqueueResult> {
  const to = normalizePhone(input.to_phone);
  if (!to || to.length < 12) {
    return { ok: false, error: "Telefone inválido." };
  }
  if (!input.body.trim()) {
    return { ok: false, error: "Mensagem vazia." };
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const scheduled_at = input.scheduled_at ?? new Date().toISOString();

    const { data, error } = await admin
      .from("whatsapp_dispatch_queue")
      .insert({
        to_phone: to,
        body: input.body,
        goal_id: input.goal_id ?? null,
        template_id: input.template_id ?? null,
        media_url: input.media_url ?? null,
        status: "pending",
        scheduled_at,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao enfileirar." };
    }

    const queueId = data.id as string;
    const dueAt = new Date(scheduled_at).getTime();
    const dueNow = !Number.isFinite(dueAt) || dueAt <= Date.now() + 2_000;
    if (!dueNow) {
      return { ok: true, queue_id: queueId, sent: false, skipped_api: false };
    }

    if (!whatsappConfigured()) {
      console.info("[whatsapp] sem Evolution; fila apenas", {
        queue_id: queueId,
      });
      await markQueue(queueId, {
        status: "skipped",
        error: "Evolution não configurada",
        sent_at: new Date().toISOString(),
      });
      return { ok: true, queue_id: queueId, sent: false, skipped_api: true };
    }

    const sent = await deliverQueueRow({
      id: queueId,
      to_phone: to,
      body: input.body,
      media_url: input.media_url,
    });
    return {
      ok: true,
      queue_id: queueId,
      sent,
      skipped_api: false,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "WhatsApp indisponível";
    console.warn("[whatsapp]", message);
    return { ok: false, error: message };
  }
}
