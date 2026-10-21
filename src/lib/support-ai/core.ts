/** Pure helpers for the AI support chat. No secrets, no I/O: safe to unit test. */

export type SupportRole = "user" | "assistant";
export interface SupportMessage {
  role: SupportRole;
  content: string;
}

export const SUPPORT_MAX_MESSAGES = 20;
export const SUPPORT_MAX_CHARS = 2000;
/** Requests per user in the sliding window. */
export const SUPPORT_RATE_LIMIT = 20;
export const SUPPORT_RATE_WINDOW_MINUTES = 10;

export const SUPPORT_PROVIDERS = {
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  xai: { label: "xAI", baseUrl: "https://api.x.ai/v1", model: "grok-3-mini" },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  custom: { label: "Outro (compatível com OpenAI)", baseUrl: "", model: "" },
} as const;

export type SupportProvider = keyof typeof SUPPORT_PROVIDERS;

export function isSupportProvider(value: unknown): value is SupportProvider {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SUPPORT_PROVIDERS, value);
}

/** Only `user`/`assistant` turns survive; trimmed, capped and ending on a user turn. */
export function sanitizeHistory(input: unknown): SupportMessage[] | null {
  if (!Array.isArray(input)) return null;
  const out: SupportMessage[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const text = content.trim().slice(0, SUPPORT_MAX_CHARS);
    if (!text) continue;
    out.push({ role, content: text });
  }
  const capped = out.slice(-SUPPORT_MAX_MESSAGES);
  if (capped.length === 0 || capped[capped.length - 1].role !== "user") return null;
  return capped;
}

/** Shows only the last 4 characters. Short keys are fully hidden. */
export function maskApiKey(key: string | null | undefined): string | null {
  const k = (key ?? "").trim();
  if (!k) return null;
  return k.length <= 8 ? "••••" : `••••${k.slice(-4)}`;
}

export function lastFour(key: string): string {
  const k = key.trim();
  return k.length <= 8 ? "" : k.slice(-4);
}

export function normalizeBaseUrl(raw: string | null | undefined, provider: SupportProvider): string | null {
  const value = (raw ?? "").trim() || SUPPORT_PROVIDERS[provider].baseUrl;
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return url.toString().replace(/\/+$/, "");
}

/**
 * One line of an OpenAI-compatible SSE stream → text delta, "done" or null.
 */
export function parseCompletionSseLine(line: string): { delta: string } | "done" | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const payload = trimmed.slice(5).trim();
  if (payload === "[DONE]") return "done";
  try {
    const json = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: unknown } }>;
    };
    const content = json.choices?.[0]?.delta?.content;
    return typeof content === "string" && content ? { delta: content } : null;
  } catch {
    return null;
  }
}

/** Our stream event to clients: one JSON object per SSE `data:` line. */
export function supportSseEvent(event: { type: "delta"; text: string } | { type: "done" } | { type: "error"; error: string }): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export interface CustomerContext {
  firstName: string;
  reservations: Array<{ product: string; status: string; listPriceCents: number; paidCents: number }>;
  goals: Array<{ name: string; frequency: string | null; targetDate: string; status: string }>;
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Behavior file + safe customer summary. No ids, CPF, phone, e-mail or Pix key. */
export function buildSystemPrompt(behaviorMd: string, ctx: CustomerContext | null, today: string): string {
  const parts = [behaviorMd.trim(), `\n---\nData de hoje (America/Sao_Paulo): ${today}.`];
  if (ctx) {
    const lines = [`Cliente: ${ctx.firstName || "cliente"}.`];
    if (ctx.reservations.length) {
      lines.push("Reservas:");
      for (const r of ctx.reservations) {
        const pct = r.listPriceCents > 0 ? Math.floor((r.paidCents / r.listPriceCents) * 100) : 0;
        lines.push(`- ${r.product}: ${r.status}, pago ${brl(r.paidCents)} de ${brl(r.listPriceCents)} (${pct}%).`);
      }
    } else {
      lines.push("Reservas: nenhuma.");
    }
    if (ctx.goals.length) {
      lines.push("Metas:");
      for (const g of ctx.goals) {
        lines.push(`- ${g.name}: ${g.frequency ?? "sem frequência"}, até ${g.targetDate}, ${g.status}.`);
      }
    }
    parts.push(`\nContexto da conta (somente leitura, não repita dados sensíveis):\n${lines.join("\n")}`);
  }
  return parts.join("\n");
}
