import { NextResponse } from "next/server";
import { simulatePixPayment } from "@/lib/pix/simulate";

/** SOMENTE TESTE. 404 quando ALLOW_PAYMENT_SIMULATION não é "true". */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    paymentId?: string;
    pixId?: string;
    payment_id?: string;
    pix_id?: string;
    contribution_id?: string;
  };
  const result = await simulatePixPayment({
    paymentId: body.paymentId ?? body.payment_id,
    pixId: body.contribution_id ?? body.pixId ?? body.pix_id,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    contribution_id: result.contribution_id,
    already_confirmed: result.already_confirmed,
    simulated: true,
  });
}
