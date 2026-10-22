import { NextResponse } from "next/server";
import { createProduct, updateProduct } from "@/lib/catalog/admin-products";
import { parseColorHexInput } from "@/lib/catalog/colors";

function parseProductImages(body: Record<string, unknown>): string[] | null {
  if (!Array.isArray(body.product_images)) return null;
  return body.product_images
    .map((u) => String(u ?? "").trim())
    .filter(Boolean);
}

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

  const hex = parseColorHexInput(body.color_hex);
  if (!hex.ok) {
    return NextResponse.json({ ok: false, error: hex.error }, { status: 400 });
  }
  const list_price_cents = Number(body.list_price_cents);
  const result = await createProduct({
    name: String(body.name ?? ""),
    slug: body.slug ? String(body.slug) : undefined,
    brand: body.brand ? String(body.brand) : undefined,
    model: String(body.model ?? ""),
    storage: String(body.storage ?? ""),
    color: body.color != null ? String(body.color) : null,
    color_hex: hex.hex,
    list_price_cents,
    image_url: body.image_url != null ? String(body.image_url) : null,
    product_images: parseProductImages(body) ?? undefined,
    description: body.description != null ? String(body.description) : null,
    description_md: body.description_md != null ? String(body.description_md) : null,
    active: body.active !== false,
    category_id: body.category_id ? String(body.category_id) : null,
    new_category_name: body.new_category_name
      ? String(body.new_category_name)
      : null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, product: result.product });
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Produto inválido." },
      { status: 400 },
    );
  }

  const hex = parseColorHexInput(body.color_hex);
  if (!hex.ok) {
    return NextResponse.json({ ok: false, error: hex.error }, { status: 400 });
  }
  const list_price_cents = Number(body.list_price_cents);
  const result = await updateProduct({
    id,
    name: String(body.name ?? ""),
    slug: body.slug ? String(body.slug) : undefined,
    brand: body.brand ? String(body.brand) : undefined,
    model: String(body.model ?? ""),
    storage: String(body.storage ?? ""),
    color: body.color != null ? String(body.color) : null,
    color_hex: hex.hex,
    list_price_cents,
    image_url: body.image_url != null ? String(body.image_url) : null,
    product_images: parseProductImages(body) ?? undefined,
    description: body.description != null ? String(body.description) : null,
    description_md: body.description_md != null ? String(body.description_md) : null,
    active: body.active !== false,
    category_id: body.category_id ? String(body.category_id) : null,
    new_category_name: body.new_category_name
      ? String(body.new_category_name)
      : null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, product: result.product });
}
