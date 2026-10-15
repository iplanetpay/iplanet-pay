import { NextResponse } from "next/server";

/**
 * Legacy Telegram webhook — descontinuado.
 * O agente AI fala com o admin via WhatsApp (app_settings.whatsapp_admin).
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Telegram descontinuado. Configure WhatsApp admin (whatsapp_admin + EVOLUTION_API_*) para o agente AI.",
    },
    { status: 503 },
  );
}

export async function GET() {
  return NextResponse.json({
    ok: false,
    configured: false,
    message:
      "Telegram removido do produto. Use o canal WhatsApp admin para o agente.",
  });
}
