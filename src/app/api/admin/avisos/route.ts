import { NextResponse } from "next/server";
import { USE_MOCK_AUTH, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  couponNotice,
  isNoticeKind,
  normalizeCouponCode,
  type NoticeKind,
} from "@/lib/notices/copy";

function missingTable(message: string) {
  return /relation|does not exist|schema cache|column/i.test(message);
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  if (USE_MOCK_AUTH) {
    return NextResponse.json({ ok: true, unavailable: true, notices: [], coupons: [], winner: null });
  }

  const supabase = await createClient();

  const [noticesRes, couponsRes, drawRes] = await Promise.all([
    supabase
      .from("platform_notices")
      .select("id, kind, title, body, coupon_code, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("platform_coupons")
      .select("id, code, title, active, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("monthly_raffle_draws")
      .select("winner_name, winner_tickets, draw_month, drawn_at")
      .order("drawn_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const unavailable =
    (noticesRes.error && missingTable(noticesRes.error.message)) ||
    (couponsRes.error && missingTable(couponsRes.error.message));

  if (unavailable) {
    return NextResponse.json({
      ok: true,
      unavailable: true,
      notices: [],
      coupons: [],
      winner: drawRes.data ?? null,
    });
  }

  if (noticesRes.error) {
    return NextResponse.json({ ok: false, error: noticesRes.error.message }, { status: 400 });
  }
  if (couponsRes.error) {
    return NextResponse.json({ ok: false, error: couponsRes.error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    notices: noticesRes.data ?? [],
    coupons: couponsRes.data ?? [],
    winner: drawRes.data ?? null,
  });
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "notice" | "coupon";
    kind?: string;
    title?: string;
    body?: string;
    coupon_code?: string;
    code?: string;
  };

  if (USE_MOCK_AUTH) {
    return NextResponse.json(
      { ok: false, error: "Avisos não são salvos no modo demonstração." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  if (body.action === "coupon") {
    const code = normalizeCouponCode(body.code);
    const title = (body.title ?? "").trim();
    if (!code || !title || title.length > 80) {
      return NextResponse.json(
        { ok: false, error: "Informe um código de 3 a 32 caracteres e um nome." },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from("platform_coupons")
      .insert({ code, title, created_by: user.id })
      .select("id, code, title, active, created_at")
      .single();
    if (error) {
      const message = /duplicate|unique/i.test(error.message)
        ? "Esse código de cupom já existe."
        : error.message;
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, coupon: data });
  }

  const kind = body.kind ?? "";
  const title = (body.title ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!isNoticeKind(kind) || !title || !text || title.length > 120 || text.length > 800) {
    return NextResponse.json(
      { ok: false, error: "Informe o tipo, o título e o texto do aviso." },
      { status: 400 },
    );
  }

  let couponCode: string | null = null;
  if (kind === "cupom") {
    const draft = couponNotice(body.coupon_code ?? "", title);
    if (!draft?.couponCode) {
      return NextResponse.json({ ok: false, error: "Escolha um cupom pré-criado." }, { status: 400 });
    }
    const { data: coupon, error: couponError } = await supabase
      .from("platform_coupons")
      .select("code")
      .eq("code", draft.couponCode)
      .eq("active", true)
      .maybeSingle();
    if (couponError || !coupon) {
      return NextResponse.json(
        { ok: false, error: "Cupom não encontrado. Cadastre o código antes de disparar." },
        { status: 400 },
      );
    }
    couponCode = coupon.code;
  }

  const { data, error } = await supabase
    .from("platform_notices")
    .insert({
      kind: kind as NoticeKind,
      title,
      body: text,
      coupon_code: couponCode,
      created_by: user.id,
    })
    .select("id, kind, title, body, coupon_code, created_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, notice: data });
}
