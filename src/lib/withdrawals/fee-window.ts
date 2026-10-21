/**
 * Regra de taxa do saque (Termos platform-v4, cláusula 11).
 *
 * - Aportes Pix confirmados há `windowDays` dias ou menos da solicitação → reembolso integral.
 * - Aportes confirmados há mais de `windowDays` dias → desconto de `feePct`%.
 * Espelha `request_withdrawal` da migration 037.
 */

export const FULL_REFUND_WINDOW_DAYS_DEFAULT = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WithdrawalSplitItem = {
  amountCents: number;
  /** Quando o aporte (ou crédito) foi confirmado. */
  confirmedAt: string | Date | null;
};

export type WithdrawalSplit = {
  totalCents: number;
  /** Parte devolvida sem desconto (dentro da janela). */
  fullRefundCents: number;
  /** Parte sobre a qual a taxa incide (fora da janela). */
  discountedCents: number;
  feePct: number;
  feeCents: number;
  netCents: number;
  windowDays: number;
};

export function isWithinFullRefundWindow(
  confirmedAt: string | Date | null,
  requestedAt: Date,
  windowDays = FULL_REFUND_WINDOW_DAYS_DEFAULT,
): boolean {
  if (!confirmedAt) return true; // sem data: em favor do cliente
  const t = new Date(confirmedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return requestedAt.getTime() - t <= windowDays * DAY_MS;
}

/**
 * @param amountCents valor sacado. Omitido = soma dos itens (saque de reserva).
 *   Para a carteira, a parte integral é limitada ao que entrou dentro da janela.
 */
export function splitWithdrawal(input: {
  items: WithdrawalSplitItem[];
  requestedAt?: Date;
  feePct: number;
  windowDays?: number;
  amountCents?: number;
}): WithdrawalSplit {
  const requestedAt = input.requestedAt ?? new Date();
  const windowDays = input.windowDays ?? FULL_REFUND_WINDOW_DAYS_DEFAULT;
  let sum = 0;
  let recent = 0;
  for (const it of input.items) {
    const cents = Math.max(0, Math.round(it.amountCents));
    sum += cents;
    if (isWithinFullRefundWindow(it.confirmedAt, requestedAt, windowDays)) recent += cents;
  }
  const total = Math.max(0, Math.round(input.amountCents ?? sum));
  const fullRefundCents = Math.min(total, recent);
  const discountedCents = total - fullRefundCents;
  const feePct = Number.isFinite(input.feePct) ? input.feePct : 30;
  const feeCents = Math.round((discountedCents * feePct) / 100);
  return {
    totalCents: total,
    fullRefundCents,
    discountedCents,
    feePct,
    feeCents,
    netCents: total - feeCents,
    windowDays,
  };
}

export type WithdrawalFeeConfig = { feePct: number; windowDays: number };

/** Mesma fonte da RPC: app_settings.withdrawal_fee_pct / withdrawal_full_refund_days. */
export function parseFeeConfig(settings: Record<string, string | undefined>): WithdrawalFeeConfig {
  const pct = Number(settings.withdrawal_fee_pct);
  const days = Number(settings.withdrawal_full_refund_days);
  return {
    feePct: settings.withdrawal_fee_pct != null && Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : 30,
    windowDays:
      settings.withdrawal_full_refund_days != null && Number.isFinite(days) && days >= 0
        ? Math.round(days)
        : FULL_REFUND_WINDOW_DAYS_DEFAULT,
  };
}
