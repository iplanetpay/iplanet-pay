import { NextResponse } from "next/server";
import { createReservation } from "@/lib/reservations/mutations";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    product_id?: string;
    store_id?: string;
    variant_id?: string | null;
  };

  const result = await createReservation(
    body.product_id ?? "",
    body.store_id ?? "",
    typeof body.variant_id === "string" && body.variant_id ? body.variant_id : null,
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    redirectTo: `/app/reserva/${result.id}`,
  });
}
