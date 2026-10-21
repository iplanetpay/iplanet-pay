import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { SUPPORT_PROVIDERS, isSupportProvider, lastFour, normalizeBaseUrl } from "@/lib/support-ai/core";

export const dynamic = "force-dynamic";

const MAX_MD = 60_000;

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Admin save. Config goes through the admin's own RLS. The key is write-only:
 * it is stored with the service role and only `api_key_last4` comes back.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Entre para continuar.");
  if (user.role !== "admin") return fail(403, "Somente admin pode alterar o suporte com IA.");

  let body: {
    enabled?: unknown;
    provider?: unknown;
    base_url?: unknown;
    model?: unknown;
    behavior_md?: unknown;
    api_key?: unknown;
    clear_api_key?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return fail(400, "JSON inválido.");
  }

  const provider = isSupportProvider(body.provider) ? body.provider : null;
  if (!provider) return fail(400, "Provedor inválido.");
  const baseUrl = normalizeBaseUrl(typeof body.base_url === "string" ? body.base_url : "", provider);
  if (!baseUrl) return fail(400, "Base URL precisa ser https:// válida.");
  const model =
    (typeof body.model === "string" ? body.model.trim() : "") || SUPPORT_PROVIDERS[provider].model;
  if (!model) return fail(400, "Informe o modelo.");
  const behaviorMd = typeof body.behavior_md === "string" ? body.behavior_md : "";
  if (behaviorMd.length > MAX_MD) return fail(400, "O arquivo de comportamento passou de 60 mil caracteres.");

  const newKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
  const clearKey = body.clear_api_key === true;

  const update: Record<string, unknown> = {
    enabled: body.enabled === true,
    provider,
    base_url: baseUrl,
    model,
    behavior_md: behaviorMd,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  if (newKey || clearKey) {
    const service = tryCreateServiceClient();
    if (!service) return fail(503, "Service role não configurada no servidor.");
    const { error } = await service
      .from("support_ai_secrets")
      .upsert({ id: 1, api_key: clearKey ? null : newKey, updated_at: new Date().toISOString() });
    if (error) return fail(500, "Falha ao salvar a chave.");
    update.api_key_set = !clearKey;
    update.api_key_last4 = clearKey ? null : lastFour(newKey);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_ai_config")
    .update(update)
    .eq("id", 1)
    .select("api_key_last4, api_key_set")
    .maybeSingle();
  if (error || !data) return fail(500, error?.message ?? "Configuração não encontrada (aplique a migração 035).");

  return NextResponse.json({ ok: true, api_key_set: data.api_key_set, api_key_last4: data.api_key_last4 });
}
