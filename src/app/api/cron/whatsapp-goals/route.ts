import { NextResponse } from "next/server";
import {
  enqueueWhatsapp,
  processDueWhatsappQueue,
  renderTemplate,
  whatsappConfigured,
} from "@/lib/whatsapp/client";
import { formatCentsBRL } from "@/lib/utils";
import { advanceReminderAt, nextReminderAt } from "@/lib/goals/reminder";
import { processDueGoalSchedule } from "@/lib/goals/whatsapp-schedule-dispatch";
import { backfillGoalSchedules } from "@/lib/goals/whatsapp-schedule-store";

/**
 * Cron: process due goal reminders.
 * Authorization: Bearer $CRON_SECRET
 * Without Evolution keys → due messages are marked skipped.
 * Pix stub text when MP missing.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error: "CRON_SECRET não configurado.",
      },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== secret) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401 },
    );
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const now = new Date().toISOString();

    const processed = await processDueWhatsappQueue();

    const goalsBackfilled = await backfillGoalSchedules();
    const goalSchedule = await processDueGoalSchedule(admin);

    // 2) Goals with reminder_at due
    const { data: dueGoals } = await admin
      .from("payment_goals")
      .select(
        `
        id, user_id, name, installment_cents, reminder_at, reminder_day, whatsapp_phone, product_id,
        product:products ( name )
      `,
      )
      .eq("status", "active")
      .not("reminder_at", "is", null)
      .lte("reminder_at", now)
      .limit(40);

    const { data: cobTpl } = await admin
      .from("whatsapp_templates")
      .select("*")
      .eq("name", "cobranca_lembrete")
      .eq("active", true)
      .maybeSingle();

    const mpMissing =
      !process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() &&
      !process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
    const pixStub = mpMissing
      ? "QR estará disponível quando Pix estiver configurado"
      : "Abra o app para gerar o Pix do próximo aporte.";

    let enqueued = 0;
    for (const g of dueGoals ?? []) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, phone")
        .eq("id", g.user_id)
        .maybeSingle();

      const phone = g.whatsapp_phone || profile?.phone;
      if (!phone) continue;

      const productName =
        (g.product as { name?: string } | null)?.name || "seu Apple";
      const vars = {
        nome: profile?.full_name?.split(" ")[0] || "olá",
        produto: productName,
        valor: formatCentsBRL(g.installment_cents),
        pix: pixStub,
        meta: g.name,
      };
      const body = cobTpl
        ? renderTemplate(cobTpl.body, vars)
        : `Lembrete: ${g.name} — aporte sugerido ${vars.valor}. ${pixStub}`;

      await enqueueWhatsapp({
        to_phone: phone,
        body,
        goal_id: g.id,
        template_id: cobTpl?.id ?? null,
      });
      enqueued += 1;

      // Advance to next month using reminder_day (clamp last day)
      const day =
        typeof g.reminder_day === "number" && g.reminder_day >= 1
          ? g.reminder_day
          : (() => {
              const d = g.reminder_at ? new Date(g.reminder_at) : new Date();
              return Math.min(
                30,
                Math.max(
                  1,
                  Number(
                    new Intl.DateTimeFormat("en-US", {
                      timeZone: "America/Sao_Paulo",
                      day: "numeric",
                    }).format(d),
                  ),
                ),
              );
            })();

      const next = advanceReminderAt(day, new Date());
      // Safety: if somehow still <= now, jump forward again
      const nextIso =
        next.getTime() <= Date.now()
          ? nextReminderAt(day).toISOString()
          : next.toISOString();

      await admin
        .from("payment_goals")
        .update({ reminder_at: nextIso, reminder_day: day })
        .eq("id", g.id);
    }

    return NextResponse.json({
      ok: true,
      queue_processed: processed,
      goals_enqueued: enqueued,
      goal_schedule: goalSchedule,
      goals_backfilled: goalsBackfilled,
      api_configured: whatsappConfigured(),
      message:
        "Lembretes processados (Evolution quando EVOLUTION_API_* está definido).",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha no cron whatsapp-goals";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
