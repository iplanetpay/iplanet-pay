import { SUPPORT_PROVIDERS, isSupportProvider } from "./core";
import type { SupportAiInitial } from "@/components/admin/support-ai-form";

/** Admin read under RLS. The key column does not exist here; only last4 + a flag. */
export async function loadSupportAiAdmin(): Promise<SupportAiInitial> {
  const fallback: SupportAiInitial = {
    available: false,
    enabled: false,
    provider: "openai",
    baseUrl: SUPPORT_PROVIDERS.openai.baseUrl,
    model: SUPPORT_PROVIDERS.openai.model,
    behaviorMd: "",
    apiKeySet: false,
    apiKeyLast4: null,
  };
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("support_ai_config")
      .select("enabled, provider, base_url, model, behavior_md, api_key_set, api_key_last4")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return fallback;
    return {
      available: true,
      enabled: Boolean(data.enabled),
      provider: isSupportProvider(data.provider) ? data.provider : "custom",
      baseUrl: String(data.base_url ?? ""),
      model: String(data.model ?? ""),
      behaviorMd: String(data.behavior_md ?? ""),
      apiKeySet: Boolean(data.api_key_set),
      apiKeyLast4: (data.api_key_last4 as string | null) ?? null,
    };
  } catch {
    return fallback;
  }
}
