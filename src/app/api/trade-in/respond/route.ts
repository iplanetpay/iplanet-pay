import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { resubmitTradeIn } from "@/lib/trade-in/workflow";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Faça login." }, { status: 401 });
  }

  const body = (await request.json()) as {
    offerId?: string;
    action?: "accept" | "reject" | "resubmit" | "discard";
    expectedCents?: number;
  };
  const offerId = body.offerId?.trim() ?? "";
  const action = body.action;
  if (!offerId || !action) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const admin = tryCreateServiceClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Serviço de avaliação indisponível." }, { status: 503 });
  }

  const { data: offer, error } = await admin
    .from("used_device_offers")
    .select("*")
    .eq("id", offerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !offer) {
    return NextResponse.json({ ok: false, error: "Avaliação não encontrada." }, { status: 404 });
  }

  if (action === "resubmit") {
    const result = await resubmitTradeIn({
      offerId,
      userId: user.id,
      expectedCents: Math.round(Number(body.expectedCents ?? 0)),
    });
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    const { error: updateError } = await admin
      .from("used_device_offers")
      .update({ status: "rejected" })
      .eq("id", offerId)
      .eq("status", "pending");
    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "accept") {
    const value = offer.approved_value_cents as number | null;
    if (!value || !offer.reviewed_at) {
      return NextResponse.json({ ok: false, error: "Não há contra-proposta para aceitar." }, { status: 400 });
    }
    const { error: rpcError } = await admin.rpc("review_used_device_offer", {
      p_offer_id: offerId,
      p_action: "approve",
      p_admin_message: offer.admin_message ?? "",
      p_approved_value_cents: value,
      p_reviewer_id: null,
    });
    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "discard") {
    const { discardTradeIn } = await import("@/lib/trade-in/workflow");
    const { data: reservation } = await admin
      .from("reservations")
      .select("amount_paid_cents")
      .eq("id", offer.reservation_id)
      .maybeSingle();
    const result = await discardTradeIn({
      offer: offer as never,
      amountPaidCents: reservation?.amount_paid_cents ?? 0,
    });
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
}
