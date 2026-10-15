import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { debitWallet, getWalletBalanceCents } from "@/lib/wallet/balance";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Entre para continuar." }, { status: 401 });
  }

  const body = (await request.json()) as {
    reservation_id?: string;
    amount_cents?: number;
  };
  const reservationId = body.reservation_id?.trim() ?? "";
  const amount = Math.round(Number(body.amount_cents ?? 0));
  if (!reservationId || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Informe a reserva e o valor." }, { status: 400 });
  }

  const admin = tryCreateServiceClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Carteira indisponível no servidor." }, { status: 503 });
  }

  const { data: reservation, error } = await admin
    .from("reservations")
    .select("id, user_id, status, list_price_cents, amount_paid_cents")
    .eq("id", reservationId)
    .maybeSingle();
  if (error || !reservation) {
    return NextResponse.json({ ok: false, error: "Reserva não encontrada." }, { status: 404 });
  }
  if (reservation.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Essa reserva não é sua." }, { status: 403 });
  }
  if (reservation.status !== "ativa") {
    return NextResponse.json({ ok: false, error: "Só reservas ativas recebem saldo da carteira." }, { status: 400 });
  }

  const remaining = Math.max(0, reservation.list_price_cents - reservation.amount_paid_cents);
  if (amount > remaining) {
    return NextResponse.json({ ok: false, error: "O valor passa do restante da reserva." }, { status: 400 });
  }
  const balance = await getWalletBalanceCents(user.id);
  if (amount > balance) {
    return NextResponse.json({ ok: false, error: "Saldo da carteira insuficiente." }, { status: 400 });
  }

  const debit = await debitWallet({
    userId: user.id,
    amountCents: amount,
    memo: `aplicacao ${reservationId}`,
    reservationId,
  });
  if (!debit.ok) {
    return NextResponse.json({ ok: false, error: debit.error }, { status: 400 });
  }

  const nextPaid = reservation.amount_paid_cents + amount;
  const nextStatus = nextPaid >= reservation.list_price_cents ? "quitada" : "ativa";
  const { error: reservationError } = await admin
    .from("reservations")
    .update({
      amount_paid_cents: nextPaid,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId);
  if (reservationError) {
    await admin.from("wallet_ledger").insert({
      user_id: user.id,
      reservation_id: reservationId,
      entry_type: "ajuste",
      amount_cents: amount,
      memo: `carteira:estorno-aplicacao ${reservationId}`,
    });
    return NextResponse.json({ ok: false, error: reservationError.message }, { status: 400 });
  }

  await admin.from("contributions").insert({
    user_id: user.id,
    reservation_id: reservationId,
    amount_cents: amount,
    payment_method: "carteira",
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, amount_paid_cents: nextPaid, status: nextStatus });
}
