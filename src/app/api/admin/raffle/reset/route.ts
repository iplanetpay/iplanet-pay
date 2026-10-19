import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRaffleAdminState } from "@/lib/raffle/queries";
import { resetRaffleTickets, revertRaffleTicketReset } from "@/lib/raffle/mutations";

type ResetAction = "reset" | "revert";

function isResetAction(value: unknown): value is ResetAction {
  return value === "reset" || value === "revert";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  let body: { action?: unknown; reset_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (!isResetAction(body.action)) {
    return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof resetRaffleTickets>>;
  switch (body.action) {
    case "reset":
      result = await resetRaffleTickets(user);
      break;
    case "revert":
      if (typeof body.reset_id !== "string" || !body.reset_id) {
        return NextResponse.json({ ok: false, error: "Reset inválido" }, { status: 400 });
      }
      result = await revertRaffleTicketReset(user, body.reset_id);
      break;
    default: {
      const unhandled: never = body.action;
      return NextResponse.json({ ok: false, error: `Ação inválida: ${unhandled}` }, { status: 400 });
    }
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...(await getRaffleAdminState()) });
}
