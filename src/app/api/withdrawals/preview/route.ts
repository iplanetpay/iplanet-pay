import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { previewReservationWithdrawal } from "@/lib/withdrawals/preview";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  const reservationId = new URL(request.url).searchParams.get("reservation_id")?.trim();
  if (!reservationId) {
    return NextResponse.json({ ok: false, error: "Informe a reserva." }, { status: 400 });
  }
  const result = await previewReservationWithdrawal(reservationId, user.id);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, split: result.split });
}
