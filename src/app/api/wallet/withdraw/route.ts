import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { debitWallet, getWalletBalanceCents } from "@/lib/wallet/balance";
import { calcWithdrawalAmounts, WITHDRAWAL_FEE_PCT_DEFAULT } from "@/lib/withdrawals/types";

const MIN_CENTS = 100_000;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Entre para continuar." }, { status: 401 });
  }

  const body = (await request.json()) as {
    amount_cents?: number;
    pix_key?: string;
    pix_key_type?: string;
    holder_full_name?: string;
    holder_cpf?: string;
  };

  const amount = Math.round(Number(body.amount_cents ?? 0));
  const pix = body.pix_key?.trim() ?? "";
  const holder = body.holder_full_name?.trim() ?? "";
  const cpf = (body.holder_cpf ?? "").replace(/\D/g, "");
  const pixType = (body.pix_key_type ?? "").toLowerCase();
  if (!pix || !holder || cpf.length !== 11) {
    return NextResponse.json({ ok: false, error: "Preencha a chave Pix, o titular e o CPF." }, { status: 400 });
  }
  if (!["cpf", "cnpj", "email", "phone", "random"].includes(pixType)) {
    return NextResponse.json({ ok: false, error: "Tipo de chave Pix inválido." }, { status: 400 });
  }
  if (amount < MIN_CENTS) {
    return NextResponse.json(
      { ok: false, error: "O saque da carteira segue o contrato: mínimo de R$ 1.000,00." },
      { status: 400 },
    );
  }

  const balance = await getWalletBalanceCents(user.id);
  if (amount > balance) {
    return NextResponse.json({ ok: false, error: "Saldo da carteira insuficiente." }, { status: 400 });
  }

  const admin = tryCreateServiceClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Carteira indisponível no servidor." }, { status: 503 });
  }

  const { data: anchor } = await admin
    .from("reservations")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!anchor?.id) {
    return NextResponse.json(
      { ok: false, error: "É preciso ter uma reserva para registrar o saque." },
      { status: 400 },
    );
  }

  const amounts = calcWithdrawalAmounts(amount, WITHDRAWAL_FEE_PCT_DEFAULT);
  const debit = await debitWallet({
    userId: user.id,
    amountCents: amount,
    memo: "saque-hold pendente",
    reservationId: anchor.id,
  });
  if (!debit.ok) {
    return NextResponse.json({ ok: false, error: debit.error }, { status: 400 });
  }

  const { data: created, error } = await admin
    .from("withdrawal_requests")
    .insert({
      user_id: user.id,
      reservation_id: anchor.id,
      total_paid_cents: amount,
      fee_percentage: WITHDRAWAL_FEE_PCT_DEFAULT,
      fee_amount_cents: amounts.fee_amount_cents,
      refund_amount_cents: amounts.refund_amount_cents,
      pix_key: pix,
      pix_key_type: pixType,
      holder_full_name: holder,
      holder_cpf: cpf,
      status: "pending",
      payout_status: "pending_admin",
      admin_notes: "carteira",
    })
    .select("id")
    .single();

  if (error || !created) {
    await admin.from("wallet_ledger").insert({
      user_id: user.id,
      reservation_id: anchor.id,
      entry_type: "ajuste",
      amount_cents: amount,
      memo: "carteira:saque-estorno falha",
    });
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Não foi possível abrir o saque." },
      { status: 400 },
    );
  }

  await admin
    .from("wallet_ledger")
    .update({ memo: `carteira:saque-hold ${created.id}` })
    .eq("user_id", user.id)
    .eq("memo", "carteira:saque-hold pendente");

  return NextResponse.json({
    ok: true,
    id: created.id,
    fee_amount_cents: amounts.fee_amount_cents,
    refund_amount_cents: amounts.refund_amount_cents,
  });
}
