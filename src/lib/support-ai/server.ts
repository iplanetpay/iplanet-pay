import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import {
  SUPPORT_RATE_LIMIT,
  SUPPORT_RATE_WINDOW_MINUTES,
  isSupportProvider,
  normalizeBaseUrl,
  type CustomerContext,
  type SupportProvider,
} from "./core";

export interface SupportRuntimeConfig {
  enabled: boolean;
  provider: SupportProvider;
  baseUrl: string | null;
  model: string;
  behaviorMd: string;
  apiKey: string | null;
}

/**
 * Server-only read with the service role: customers cannot read the config rows
 * (admin-only RLS) and nobody but the service role can read the key.
 * `SUPPORT_AI_API_KEY` in the environment is a fallback, like the other secrets.
 */
export async function loadSupportRuntimeConfig(): Promise<SupportRuntimeConfig | null> {
  const service = tryCreateServiceClient();
  if (!service) return null;
  const [{ data: cfg }, { data: secret }] = await Promise.all([
    service
      .from("support_ai_config")
      .select("enabled, provider, base_url, model, behavior_md")
      .eq("id", 1)
      .maybeSingle(),
    service.from("support_ai_secrets").select("api_key").eq("id", 1).maybeSingle(),
  ]);
  if (!cfg) return null;
  const provider: SupportProvider = isSupportProvider(cfg.provider) ? cfg.provider : "custom";
  const apiKey = (secret?.api_key as string | null)?.trim() || process.env.SUPPORT_AI_API_KEY?.trim() || null;
  return {
    enabled: Boolean(cfg.enabled),
    provider,
    baseUrl: normalizeBaseUrl(cfg.base_url as string, provider),
    model: String(cfg.model ?? "").trim(),
    behaviorMd: String(cfg.behavior_md ?? ""),
    apiKey,
  };
}

/** Counts and records under the user's own RLS. Returns false when over the limit. */
export async function consumeSupportQuota(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const since = new Date(Date.now() - SUPPORT_RATE_WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await supabase
    .from("support_ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) return false;
  if ((count ?? 0) >= SUPPORT_RATE_LIMIT) return false;
  const { error: insertError } = await supabase.from("support_ai_usage").insert({ user_id: userId });
  return !insertError;
}

/** Read under the user's RLS. Failure yields an empty context, not an error. */
export async function loadCustomerContext(userId: string, fullName: string): Promise<CustomerContext> {
  const supabase = await createClient();
  const [{ data: reservations }, { data: goals }] = await Promise.all([
    supabase
      .from("reservations")
      .select("status, list_price_cents, amount_paid_cents, products(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("payment_goals")
      .select("name, frequency, target_date, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  return {
    firstName: fullName.trim().split(/\s+/)[0] ?? "",
    reservations: (reservations ?? []).map((r) => {
      const product = (r as { products?: { name?: string } | { name?: string }[] | null }).products;
      const name = Array.isArray(product) ? product[0]?.name : product?.name;
      return {
        product: name ?? "Produto",
        status: String(r.status),
        listPriceCents: Number(r.list_price_cents ?? 0),
        paidCents: Number(r.amount_paid_cents ?? 0),
      };
    }),
    goals: (goals ?? []).map((g) => ({
      name: String(g.name),
      frequency: (g.frequency as string | null) ?? null,
      targetDate: String(g.target_date),
      status: String(g.status),
    })),
  };
}

export async function loadSupportWhatsapp(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "whatsapp_support")
    .maybeSingle();
  const digits = String(data?.value ?? "").replace(/\D/g, "");
  return digits || null;
}
