import { NextResponse } from "next/server";
import { paymentSimulationEnabled } from "@/lib/pix/simulation-guard";

export const dynamic = "force-dynamic";

/** Diz ao app/site se o botão "Pago (teste)" deve aparecer. */
export async function GET() {
  return NextResponse.json(
    { enabled: paymentSimulationEnabled() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
