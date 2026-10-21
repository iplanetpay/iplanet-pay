import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  buildSystemPrompt,
  parseCompletionSseLine,
  sanitizeHistory,
  supportSseEvent,
} from "@/lib/support-ai/core";
import {
  consumeSupportQuota,
  loadCustomerContext,
  loadSupportRuntimeConfig,
  loadSupportWhatsapp,
} from "@/lib/support-ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function todaySaoPaulo(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full" }).format(new Date());
}

/**
 * POST /api/support/chat — cookie session or `Authorization: Bearer <access_token>`.
 * Body: { messages: [{ role: "user"|"assistant", content }], stream?: boolean }.
 * The provider key is read server-side with the service role and never leaves the server.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Entre para continuar.");

  let body: { messages?: unknown; stream?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "JSON inválido.");
  }
  const messages = sanitizeHistory(body.messages);
  if (!messages) return fail(400, "Envie o histórico terminando com uma mensagem do cliente.");
  const stream = body.stream !== false;

  const config = await loadSupportRuntimeConfig().catch(() => null);
  const whatsapp = await loadSupportWhatsapp().catch(() => null);
  if (!config || !config.enabled || !config.apiKey || !config.baseUrl || !config.model) {
    return fail(503, "O suporte com IA está indisponível agora. Fale com a equipe no WhatsApp.", {
      handoff: true,
      whatsapp,
    });
  }

  if (!(await consumeSupportQuota(user.id))) {
    return fail(429, "Muitas mensagens em pouco tempo. Aguarde alguns minutos e tente de novo.");
  }

  const context = await loadCustomerContext(user.id, user.full_name ?? "").catch(() => null);
  let system = buildSystemPrompt(config.behaviorMd, context, todaySaoPaulo());
  if (whatsapp) system += `\nWhatsApp oficial do suporte humano: +${whatsapp}.`;

  let upstream: Response;
  try {
    upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream,
        temperature: 0.3,
        max_tokens: 700,
        messages: [{ role: "system", content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return fail(502, "Não consegui falar com o provedor de IA. Tente de novo.");
  }
  if (!upstream.ok || !upstream.body) {
    // Status only: the provider body may echo request details.
    console.error("support-ai upstream status", upstream.status);
    return fail(502, "O provedor de IA recusou a solicitação. Tente de novo em instantes.");
  }

  if (!stream) {
    const json = (await upstream.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    const reply = json?.choices?.[0]?.message?.content?.trim();
    if (!reply) return fail(502, "Resposta vazia do provedor de IA.");
    return NextResponse.json({ ok: true, reply, whatsapp });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const parsed = parseCompletionSseLine(line);
            if (parsed === "done") continue;
            if (parsed) controller.enqueue(encoder.encode(supportSseEvent({ type: "delta", text: parsed.delta })));
          }
        }
        const tail = parseCompletionSseLine(buffer);
        if (tail && tail !== "done") controller.enqueue(encoder.encode(supportSseEvent({ type: "delta", text: tail.delta })));
        controller.enqueue(encoder.encode(supportSseEvent({ type: "done" })));
      } catch {
        controller.enqueue(encoder.encode(supportSseEvent({ type: "error", error: "A resposta foi interrompida. Tente de novo." })));
      } finally {
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(out, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
