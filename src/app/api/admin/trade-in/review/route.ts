import { NextResponse } from "next/server";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { getCurrentUser } from "@/lib/auth/session";
import { mockReviewOffer } from "@/lib/trade-in/mock";
import { getTradeInServiceClient } from "@/lib/trade-in/queries";
import { sendCounterOffer } from "@/lib/trade-in/workflow";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["admin", "staff"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  const body = (await req.json()) as {
    offerId?: string;
    action?: "approve" | "reject" | "counter";
    adminMessage?: string;
    approvedValueCents?: number;
  };

  const offerId = body.offerId?.trim();
  const action = body.action;
  if (!offerId || !action || !["approve", "reject", "counter"].includes(action)) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  if (USE_MOCK_AUTH) {
    const result = mockReviewOffer({
      offerId,
      action,
      message: body.adminMessage ?? "",
      valueCents: body.approvedValueCents ?? null,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  try {
    const admin = getTradeInServiceClient();
    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "SUPABASE_SERVICE_ROLE_KEY não configurada. Configure no servidor para aprovar/recusar ofertas.",
        },
        { status: 503 },
      );
    }
    if (action === "approve") {
      const { data: offer, error: offerError } = await admin
        .from("used_device_offers")
        .select("expected_value_cents")
        .eq("id", offerId)
        .maybeSingle();
      if (offerError || !offer) {
        return NextResponse.json(
          { ok: false, error: offerError?.message ?? "Solicitação não encontrada." },
          { status: 400 },
        );
      }
      body.approvedValueCents = offer.expected_value_cents;
    }

    if (action === "counter") {
      const result = await sendCounterOffer({
        offerId,
        message: body.adminMessage ?? "",
        valueCents: body.approvedValueCents ?? 0,
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    const { data, error } = await admin.rpc("review_used_device_offer", {
      p_offer_id: offerId,
      p_action: action,
      p_admin_message: body.adminMessage ?? "",
      p_approved_value_cents: body.approvedValueCents ?? null,
      p_reviewer_id: user.id,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Falha" },
      { status: 500 },
    );
  }
}
