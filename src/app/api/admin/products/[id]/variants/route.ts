import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { hexFromColorName, parseColorHexInput } from "@/lib/catalog/colors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("product_variants")
      .select("*")
      .eq("product_id", id)
      .order("created_at");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, variants: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Falha" },
      { status: 503 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }
  const { id: productId } = await context.params;
  let body: {
    model?: string;
    color?: string;
    color_hex?: string | null;
    storage?: string;
    price_cents?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  if (!body.price_cents || body.price_cents <= 0) {
    return NextResponse.json({ ok: false, error: "Preço inválido" }, { status: 400 });
  }
  const hex = parseColorHexInput(body.color_hex);
  if (!hex.ok) return NextResponse.json({ ok: false, error: hex.error }, { status: 400 });
  const color = body.color?.trim() || null;
  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("product_variants")
      .insert({
        product_id: productId,
        model: body.model?.trim() || null,
        color,
        color_hex: color ? (hex.hex ?? hexFromColorName(color)) : null,
        storage: body.storage?.trim() || null,
        price_cents: body.price_cents,
        active: true,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, variant: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Falha" },
      { status: 503 },
    );
  }
}

/** Atualiza cor / hex / ativo de uma variante (admin). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }
  const { id: productId } = await context.params;
  let body: { variant_id?: string; color?: string | null; color_hex?: string | null; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  if (!body.variant_id) {
    return NextResponse.json({ ok: false, error: "Variante inválida" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if ("color_hex" in body) {
    const hex = parseColorHexInput(body.color_hex);
    if (!hex.ok) return NextResponse.json({ ok: false, error: hex.error }, { status: 400 });
    patch.color_hex = hex.hex;
  }
  if ("color" in body) patch.color = body.color?.trim() || null;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Nada para atualizar" }, { status: 400 });
  }
  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("product_variants")
      .update(patch)
      .eq("id", body.variant_id)
      .eq("product_id", productId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, variant: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Falha" },
      { status: 503 },
    );
  }
}
