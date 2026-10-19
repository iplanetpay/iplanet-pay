import { getCurrentUser } from "@/lib/auth/session";
import { MOCK_USERS, USE_MOCK_AUTH } from "@/lib/auth/mock";
import {
  DEFAULT_GOAL_NOTICE_BODIES,
  GOAL_NOTICE_TEMPLATE_NAMES,
  type GoalScheduleListItem,
} from "@/lib/goals/whatsapp-schedule";
import { listGoalScheduleForUser } from "@/lib/goals/whatsapp-schedule-store";
import type { WhatsappTemplate } from "@/types/database";
import { enqueueWhatsapp, renderTemplate, whatsappConfigured } from "./client";
import { selectedLeadPhones } from "./lead-selection";
import { formatCentsBRL } from "@/lib/utils";

export async function listWhatsappTemplates(): Promise<{
  templates: WhatsappTemplate[];
  error: string | null;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { templates: [], error: "Somente admin." };
  }
  if (USE_MOCK_AUTH) {
    return {
      templates: [
        {
          id: "mock-1",
          name: "primeiro_aporte",
          kind: "aviso",
          body: "Oi {{nome}}! Aporte {{valor}} em {{produto}}.",
          active: true,
        },
        {
          id: "mock-meta-vespera",
          name: GOAL_NOTICE_TEMPLATE_NAMES.day_before,
          kind: "cobranca",
          body: DEFAULT_GOAL_NOTICE_BODIES.day_before,
          active: true,
        },
        {
          id: "mock-meta-atraso",
          name: GOAL_NOTICE_TEMPLATE_NAMES.late,
          kind: "cobranca",
          body: DEFAULT_GOAL_NOTICE_BODIES.late,
          active: true,
        },
      ],
      error: null,
    };
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .order("name");
    if (error) return { templates: [], error: error.message };
    return { templates: (data ?? []) as WhatsappTemplate[], error: null };
  } catch (err) {
    return {
      templates: [],
      error: err instanceof Error ? err.message : "Falha",
    };
  }
}

export async function createWhatsappTemplate(input: {
  name: string;
  kind: string;
  body: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Somente admin." };
  }
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Nome inválido." };
  if (USE_MOCK_AUTH) return { ok: true, id: "mock-new" };
  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("whatsapp_templates")
      .insert({
        name,
        kind: input.kind || "aviso",
        body: input.body,
        active: true,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha",
    };
  }
}

export type WhatsappLeadRow = {
  user_id: string;
  full_name: string;
  phone: string;
  active: boolean;
  last_activity_at: string | null;
};

export async function listWhatsappBroadcastLeads(): Promise<{
  leads: WhatsappLeadRow[];
  error: string | null;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { leads: [], error: "Somente admin." };
  }
  if (USE_MOCK_AUTH) {
    return {
      leads: [
        {
          user_id: "1",
          full_name: "Maria",
          phone: "5511999999999",
          active: true,
          last_activity_at: new Date().toISOString(),
        },
        {
          user_id: MOCK_USERS.cliente.id,
          full_name: MOCK_USERS.cliente.full_name ?? "Cliente",
          phone: MOCK_USERS.cliente.phone ?? "",
          active: true,
          last_activity_at: new Date().toISOString(),
        },
        {
          user_id: "3",
          full_name: "João Pereira",
          phone: "(21) 98888-7777",
          active: false,
          last_activity_at: null,
        },
      ],
      error: null,
    };
  }
  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const cutoff = new Date(Date.now() - 45 * 86_400_000).toISOString();
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, phone, role")
      .eq("role", "cliente")
      .not("phone", "is", null);

    const ids = (profiles ?? []).map((p) => p.id);
    const { data: contribs } = ids.length
      ? await admin
          .from("contributions")
          .select("user_id, created_at")
          .in("user_id", ids)
          .order("created_at", { ascending: false })
      : { data: [] as Array<{ user_id: string; created_at: string }> };

    const lastMap = new Map<string, string>();
    for (const c of contribs ?? []) {
      if (!lastMap.has(c.user_id)) lastMap.set(c.user_id, c.created_at);
    }

    const leads: WhatsappLeadRow[] = (profiles ?? [])
      .filter((p) => p.phone)
      .map((p) => {
        const last = lastMap.get(p.id) ?? null;
        const active = Boolean(last && last >= cutoff);
        return {
          user_id: p.id,
          full_name: p.full_name ?? "Cliente",
          phone: p.phone as string,
          active,
          last_activity_at: last,
        };
      });

    return { leads, error: null };
  } catch (err) {
    return {
      leads: [],
      error: err instanceof Error ? err.message : "Falha",
    };
  }
}

export async function listLeadGoalSchedule(userId: string): Promise<{
  rows: GoalScheduleListItem[];
  error: string | null;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { rows: [], error: "Somente admin." };
  }
  if (!userId.trim()) return { rows: [], error: "Cliente inválido." };
  return listGoalScheduleForUser(userId.trim());
}

export async function deleteWhatsappTemplate(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Somente admin." };
  if (USE_MOCK_AUTH) return { ok: true };
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha" };
  }
}

export async function updateWhatsappTemplate(input: {
  id: string;
  body: string;
  name?: string;
  kind?: string;
  active?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Somente admin." };
  }
  if (USE_MOCK_AUTH) return { ok: true };
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const patch: Record<string, unknown> = { body: input.body };
    if (input.name?.trim()) patch.name = input.name.trim().replace(/\s+/g, " ");
    if (input.kind) patch.kind = input.kind;
    if (typeof input.active === "boolean") patch.active = input.active;
    const { error } = await supabase
      .from("whatsapp_templates")
      .update(patch)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha",
    };
  }
}

export type BroadcastAudience = "clients_phone" | "active_goals" | "paste" | "selected_leads";

export function isBroadcastAudience(value: unknown): value is BroadcastAudience {
  return (
    value === "clients_phone" ||
    value === "active_goals" ||
    value === "paste" ||
    value === "selected_leads"
  );
}

export async function broadcastWhatsapp(input: {
  template_id: string;
  audience: BroadcastAudience;
  paste_phones?: string;
}): Promise<
  | {
      ok: true;
      enqueued: number;
      api_configured: boolean;
      results: Array<{ phone: string; name: string; ok: boolean; error?: string }>;
    }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Somente admin." };
  }
  if (USE_MOCK_AUTH) {
    return { ok: true, enqueued: 0, api_configured: false, results: [] };
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();

    const { data: tpl, error: tplErr } = await admin
      .from("whatsapp_templates")
      .select("*")
      .eq("id", input.template_id)
      .maybeSingle();
    if (tplErr || !tpl) {
      return { ok: false, error: tplErr?.message ?? "Template não encontrado." };
    }

    const phones: Array<{ phone: string; nome: string; produto: string; meta: string }> =
      [];

    if (input.audience === "selected_leads") {
      const wanted = selectedLeadPhones((input.paste_phones ?? "").split(/[\s,;]+/));
      if (wanted.length === 0) {
        return { ok: false, error: "Selecione ao menos um lead." };
      }
      const { data: profiles } = await admin
        .from("profiles")
        .select("full_name, phone")
        .eq("role", "cliente")
        .not("phone", "is", null);
      const names = new Map<string, string>();
      for (const p of profiles ?? []) {
        const [phone] = selectedLeadPhones([p.phone]);
        if (phone && !names.has(phone)) names.set(phone, p.full_name?.split(" ")[0] || "olá");
      }
      for (const phone of wanted) {
        phones.push({
          phone,
          nome: names.get(phone) ?? "olá",
          produto: "iPlanet Pay",
          meta: "sua conta",
        });
      }
    } else if (input.audience === "paste") {
      const raw = (input.paste_phones ?? "")
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const p of raw) {
        phones.push({
          phone: p,
          nome: "olá",
          produto: "iPlanet Pay",
          meta: "promoção",
        });
      }
    } else if (input.audience === "clients_phone") {
      const { data: profiles } = await admin
        .from("profiles")
        .select("full_name, phone, role")
        .eq("role", "cliente")
        .not("phone", "is", null);
      for (const p of profiles ?? []) {
        if (!p.phone) continue;
        phones.push({
          phone: p.phone,
          nome: p.full_name?.split(" ")[0] || "olá",
          produto: "iPlanet Pay",
          meta: "sua conta",
        });
      }
    } else {
      const { data: goals } = await admin
        .from("payment_goals")
        .select("id, name, whatsapp_phone, user_id, product_id")
        .eq("status", "active");
      const userIds = [...new Set((goals ?? []).map((g) => g.user_id))];
      const productIds = [
        ...new Set((goals ?? []).map((g) => g.product_id).filter(Boolean)),
      ];
      const { data: profiles } = userIds.length
        ? await admin
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", userIds)
        : { data: [] as Array<{ id: string; full_name: string | null; phone: string | null }> };
      const { data: products } = productIds.length
        ? await admin.from("products").select("id, name").in("id", productIds)
        : { data: [] as Array<{ id: string; name: string }> };
      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p] as const),
      );
      const productMap = new Map(
        (products ?? []).map((p) => [p.id, p] as const),
      );
      for (const g of goals ?? []) {
        const profile = profileMap.get(g.user_id);
        const phone = g.whatsapp_phone || profile?.phone;
        if (!phone) continue;
        phones.push({
          phone,
          nome: profile?.full_name?.split(" ")[0] || "olá",
          produto: productMap.get(g.product_id)?.name || "seu Apple",
          meta: g.name,
        });
      }
    }

    let enqueued = 0;
    const results: Array<{ phone: string; name: string; ok: boolean; error?: string }> = [];
    for (const row of phones) {
      const body = renderTemplate(tpl.body, {
        nome: row.nome,
        produto: row.produto,
        valor: formatCentsBRL(0),
        pix: "QR estará disponível quando Pix estiver configurado",
        meta: row.meta,
      });
      const r = await enqueueWhatsapp({
        to_phone: row.phone,
        body,
        template_id: tpl.id,
      });
      if (r.ok && r.sent) {
        enqueued += 1;
        results.push({ phone: row.phone, name: row.nome, ok: true });
      } else {
        results.push({
          phone: row.phone,
          name: row.nome,
          ok: false,
          error: r.ok ? (r.skipped_api ? "Evolution desligada" : "Não enviado") : r.error,
        });
      }
    }

    return {
      ok: true,
      enqueued,
      api_configured: whatsappConfigured(),
      results,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha no disparo",
    };
  }
}

export { whatsappConfigured };
