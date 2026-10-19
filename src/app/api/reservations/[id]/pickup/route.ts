import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOpenFulfillment, initialFulfillmentStatus } from "@/lib/pickup/fulfillment";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id: reservationId } = await context.params;
  let body: {
    mode?: "store" | "shipping";
    shipping_method?: string;
    address?: Record<string, string>;
    freight_cents?: number;
    insurance_cents?: number;
    loan_contract_signed?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (body.mode !== "store" && body.mode !== "shipping") {
    return NextResponse.json({ ok: false, error: "Modo inválido" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "DB indisponível" },
      { status: 503 },
    );
  }

  const { data: reservation, error: rErr } = await supabase
    .from("reservations")
    .select("id, user_id, status, list_price_cents, amount_paid_cents")
    .eq("id", reservationId)
    .maybeSingle();

  if (rErr || !reservation) {
    return NextResponse.json({ ok: false, error: "Reserva não encontrada" }, { status: 404 });
  }
  if (reservation.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  const pct =
    reservation.list_price_cents > 0
      ? Math.floor(
          (reservation.amount_paid_cents / reservation.list_price_cents) * 100,
        )
      : 0;

  if (pct < 70 && reservation.status !== "quitada") {
    return NextResponse.json(
      { ok: false, error: "Retirada disponível a partir de 70% ou 100% quitado." },
      { status: 400 },
    );
  }

  if (pct >= 70 && pct < 100 && !body.loan_contract_signed) {
    return NextResponse.json(
      { ok: false, error: "Aceite o contrato de empréstimo para entrega antecipada." },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from("pickup_requests")
    .select("status")
    .eq("reservation_id", reservationId);
  if (hasOpenFulfillment(existing ?? [])) {
    return NextResponse.json(
      { ok: false, error: "Já existe uma retirada ou envio em andamento para esta reserva." },
      { status: 409 },
    );
  }

  const loanSignedAt =
    pct >= 70 && pct < 100 && body.loan_contract_signed ? new Date().toISOString() : null;

  const { error: insErr } = await supabase.from("pickup_requests").insert({
    reservation_id: reservationId,
    user_id: user.id,
    mode: body.mode,
    shipping_method: body.mode === "shipping" ? body.shipping_method ?? null : null,
    address_json: body.mode === "shipping" ? body.address ?? null : null,
    freight_cents: body.mode === "shipping" ? body.freight_cents ?? 0 : 0,
    insurance_cents: body.mode === "shipping" ? body.insurance_cents ?? 0 : 0,
    loan_contract_signed_at: loanSignedAt,
    status: initialFulfillmentStatus(body.mode),
  });

  if (insErr) {
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  if (reservation.status === "quitada" || pct >= 100) {
    await supabase
      .from("reservations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", reservationId);
  }

  return NextResponse.json({ ok: true });
}
