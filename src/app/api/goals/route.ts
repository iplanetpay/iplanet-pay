import { NextResponse } from "next/server";
import { saveContributionMeta } from "@/lib/goals/contribution-goal";
import { createPaymentGoal } from "@/lib/goals/mutations";
import { normalizeBrazilPhone } from "@/lib/phone";
import { isContributionFrequency } from "@/lib/reservations/contribution-plan";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  if (body.frequency != null && body.frequency !== "") {
    const frequency = String(body.frequency);
    if (!isContributionFrequency(frequency)) {
      return NextResponse.json(
        { ok: false, error: "Frequência inválida." },
        { status: 400 },
      );
    }
    const planned = await saveContributionMeta({
      name: String(body.name ?? ""),
      product_id: String(body.product_id ?? ""),
      variant_id: typeof body.variant_id === "string" && body.variant_id ? body.variant_id : null,
      target_date: String(body.target_date ?? ""),
      start_date: String(body.start_date ?? ""),
      frequency,
      reservation_id: body.reservation_id ? String(body.reservation_id) : null,
    });
    if (!planned.ok) {
      return NextResponse.json(
        { ok: false, error: planned.error, needsAuth: planned.needsAuth },
        { status: planned.needsAuth ? 401 : 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      goal_id: planned.goal_id,
      reservation_id: planned.reservation_id,
    });
  }

  const reminderRaw = body.reminder_day ?? body.reminderDay;
  const reminder_day =
    reminderRaw === null || reminderRaw === undefined || reminderRaw === ""
      ? null
      : Number(reminderRaw);

  const result = await createPaymentGoal({
    product_id: String(body.product_id ?? ""),
    name: String(body.name ?? ""),
    target_date: String(body.target_date ?? ""),
    reminder_day:
      reminder_day != null && Number.isFinite(reminder_day)
        ? reminder_day
        : null,
    reminder_at: body.reminder_at ? String(body.reminder_at) : null,
    amount_cents: Number(body.amount_cents),
    installment_cents: Number(body.installment_cents),
    installments_count: Number(body.installments_count),
    whatsapp_phone: body.whatsapp_phone
      ? normalizeBrazilPhone(String(body.whatsapp_phone))
      : null,
    reservation_id: body.reservation_id
      ? String(body.reservation_id)
      : null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, needsAuth: result.needsAuth },
      { status: result.needsAuth ? 401 : 400 },
    );
  }
  return NextResponse.json({ ok: true, goal_id: result.goal_id });
}
