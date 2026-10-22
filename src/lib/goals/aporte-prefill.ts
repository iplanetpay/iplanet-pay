/** Mínimo por aporte (igual ao app: LegalCopy.minimumContributionCents). */
export const MIN_APORTE_CENTS = 500;

/**
 * Valor que já vem no campo quando o cliente toca "Fazer aporte" na meta:
 * a parcela definida na meta, limitada ao que falta na reserva e nunca abaixo do mínimo
 * (a não ser que falte menos que o mínimo). 0 = sem sugestão.
 */
export function goalAporteCents(input: {
  installmentCents: number | null | undefined;
  remainingCents?: number | null;
  minimumCents?: number;
}): number {
  const installment = Math.round(Number(input.installmentCents ?? 0));
  if (!Number.isFinite(installment) || installment <= 0) return 0;
  const min = input.minimumCents ?? MIN_APORTE_CENTS;
  let cents = Math.max(installment, min);
  const remaining = input.remainingCents;
  if (remaining != null && Number.isFinite(remaining)) {
    if (remaining <= 0) return 0;
    cents = Math.min(cents, Math.round(remaining));
  }
  return cents;
}

/** Lê ?aporte=<centavos> da URL da reserva. */
export function parseAporteParam(value: string | string[] | null | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,9}$/.test(raw)) return 0;
  return Number(raw);
}

/** Valor inicial do campo (reais, "123.45") no formulário do Pix. */
export function initialAporteBrl(prefillCents: number, remainingCents: number): string {
  const suggested = goalAporteCents({ installmentCents: prefillCents, remainingCents });
  if (suggested > 0) return (suggested / 100).toFixed(2);
  const fallback = Math.min(50, Math.max(5, remainingCents / 100));
  return Number.isFinite(fallback) ? fallback.toFixed(2) : "5.00";
}

/** "Fazer aporte" da meta abre a reserva com a parcela da meta já no campo de valor. */
export function goalDepositHref(reservationId: string, installmentCents: number | null | undefined): string {
  const cents = goalAporteCents({ installmentCents });
  return cents > 0 ? `/app/reserva/${reservationId}?aporte=${cents}` : `/app/reserva/${reservationId}`;
}
