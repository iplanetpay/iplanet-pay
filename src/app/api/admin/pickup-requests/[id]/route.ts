import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { updateFulfillmentRequest, type FulfillmentUpdate } from "@/lib/pickup/admin-queries";
import { isFulfillmentStatus } from "@/lib/pickup/fulfillment";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const update: FulfillmentUpdate = {};
  if (body.status !== undefined) {
    if (!isFulfillmentStatus(body.status)) {
      return NextResponse.json({ ok: false, error: "Status inválido" }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body.tracking_code !== undefined) update.tracking_code = String(body.tracking_code ?? "");
  if (body.admin_notes !== undefined) update.admin_notes = String(body.admin_notes ?? "");

  const { id } = await context.params;
  const result = await updateFulfillmentRequest(id, update, user.id);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true });
}
