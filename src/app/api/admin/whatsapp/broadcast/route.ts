import { NextResponse } from "next/server";
import { broadcastWhatsapp, isBroadcastAudience } from "@/lib/whatsapp/admin";

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
  const audience = body.audience ?? "clients_phone";
  if (!isBroadcastAudience(audience)) {
    return NextResponse.json(
      { ok: false, error: "Audiência inválida." },
      { status: 400 },
    );
  }
  const result = await broadcastWhatsapp({
    template_id: String(body.template_id ?? ""),
    audience,
    paste_phones: body.paste_phones ? String(body.paste_phones) : "",
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }
  return NextResponse.json(result);
}
