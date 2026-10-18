import { NextResponse } from "next/server";
import { analyticsPersistMode } from "@/lib/analytics/persist";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";

const ALLOWED = new Set([
  "page_view",
  "product_click",
  "contribution_start",
  "signup",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      event_type?: string;
      path?: string;
      product_id?: string;
      meta?: Record<string, unknown>;
    };

    if (!body.event_type || !ALLOWED.has(body.event_type)) {
      return NextResponse.json({ ok: false, error: "event_type inválido" }, { status: 400 });
    }

    if (analyticsPersistMode(USE_MOCK_AUTH) === "skip") {
      return NextResponse.json({ ok: true });
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("analytics_events").insert({
      event_type: body.event_type,
      path: body.path ?? null,
      product_id: body.product_id ?? null,
      user_id: user?.id ?? null,
      meta: body.meta ?? {},
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao registrar evento";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
