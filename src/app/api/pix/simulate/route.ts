import { NextResponse } from "next/server";
import { simulatePixPayment } from "@/lib/pix/simulate";

/**
 * Rota antiga do botão "Avançar". Agora segue as mesmas travas de
 * /api/dev/simulate-payment (404 sem ALLOW_PAYMENT_SIMULATION=true).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { contribution_id?: string };
  const result = await simulatePixPayment({ pixId: body.contribution_id });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, already_confirmed: result.already_confirmed });
}
