import { NextResponse } from "next/server";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { getCurrentUser } from "@/lib/auth/session";
import { mockRecordDraw } from "@/lib/raffle/mock";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  let body: {
    winner_user_id?: string;
    winner_name?: string;
    winner_tickets?: number;
    total_tickets_pool?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (!body.winner_user_id || !body.winner_name) {
    return NextResponse.json({ ok: false, error: "Vencedor inválido" }, { status: 400 });
  }

  if (USE_MOCK_AUTH) {
    const draw = mockRecordDraw(body.winner_user_id, body.winner_name);
    return NextResponse.json({ ok: true, draw: { id: draw.id } });
  }

  const drawMonth = new Date();
  drawMonth.setDate(1);
  const drawMonthStr = drawMonth.toISOString().slice(0, 10);

  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("monthly_raffle_draws")
      .upsert(
        {
          draw_month: drawMonthStr,
          winner_user_id: body.winner_user_id,
          winner_name: body.winner_name,
          winner_tickets: body.winner_tickets ?? 0,
          total_tickets_pool: body.total_tickets_pool ?? 0,
          drawn_by: user.id,
          drawn_at: new Date().toISOString(),
        },
        { onConflict: "draw_month" },
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, draw: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Falha" },
      { status: 503 },
    );
  }
}
