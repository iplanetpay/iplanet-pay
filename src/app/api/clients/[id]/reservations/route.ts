import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getClientActivity,
  getClientDetail,
  listClientReservations,
} from "@/lib/clients/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autenticado." },
      { status: 401 },
    );
  }
  if (user.role !== "admin" && user.role !== "staff") {
    return NextResponse.json(
      { ok: false, error: "Sem permissão." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const [{ reservations, error }, { detail }, activity] = await Promise.all([
    listClientReservations(id),
    getClientDetail(id),
    getClientActivity(id),
  ]);
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, reservations, detail, activity });
}
