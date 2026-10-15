import { NextResponse } from "next/server";
import {
  createWhatsappTemplate,
  deleteWhatsappTemplate,
  listWhatsappTemplates,
  updateWhatsappTemplate,
} from "@/lib/whatsapp/admin";

export async function GET() {
  const { templates, error } = await listWhatsappTemplates();
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }
  return NextResponse.json({ ok: true, templates });
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
  const result = await createWhatsappTemplate({
    name: String(body.name ?? ""),
    kind: String(body.kind ?? "aviso"),
    body: String(body.body ?? ""),
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, id: result.id });
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
    const result = await updateWhatsappTemplate({
    id: String(body.id ?? ""),
    body: String(body.body ?? ""),
    name: body.name ? String(body.name) : undefined,
    kind: body.kind ? String(body.kind) : undefined,
    active: typeof body.active === "boolean" ? body.active : undefined,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  const result = await deleteWhatsappTemplate(String(body.id ?? ""));
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
