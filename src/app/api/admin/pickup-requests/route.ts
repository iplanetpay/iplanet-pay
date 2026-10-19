import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listFulfillmentRequests } from "@/lib/pickup/admin-queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["admin", "staff"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  const { rows, error } = await listFulfillmentRequests();
  if (error) return NextResponse.json({ ok: false, error }, { status: 503 });
  return NextResponse.json({ ok: true, rows });
}
