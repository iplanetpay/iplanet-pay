import { Card } from "@/components/ui/card";
import { formatCentsBRL } from "@/lib/utils";
import { WITHDRAWAL_FEE_PCT_DEFAULT } from "@/lib/withdrawals/types";
import { FULL_REFUND_WINDOW_DAYS_DEFAULT } from "@/lib/withdrawals/fee-window";

/**
 * Quebra do saque (Termos 11.2): parte devolvida integralmente (aportes de até
 * 7 dias), parte com desconto, taxa e líquido.
 */
export function WithdrawalFeeBreakdown({
  totalPaidCents,
  feePct = WITHDRAWAL_FEE_PCT_DEFAULT,
  feeAmountCents,
  refundAmountCents,
  fullRefundCents,
  discountedCents,
  windowDays = FULL_REFUND_WINDOW_DAYS_DEFAULT,
  totalLabel = "Aportes confirmados",
  compact = false,
  settled = false,
}: {
  totalPaidCents: number;
  feePct?: number;
  feeAmountCents?: number;
  refundAmountCents?: number;
  /** Parte sem desconto. Ausente = registro antigo, tudo com desconto. */
  fullRefundCents?: number;
  discountedCents?: number;
  windowDays?: number;
  totalLabel?: string;
  compact?: boolean;
  settled?: boolean;
}) {
  const full = Math.max(0, fullRefundCents ?? 0);
  const discounted = Math.max(0, discountedCents ?? totalPaidCents - full);
  const fee = feeAmountCents ?? Math.round((discounted * feePct) / 100);
  const refund = refundAmountCents ?? totalPaidCents - fee;

  return (
    <Card
      className={
        compact
          ? "space-y-2 bg-[var(--bg-subtle)] p-4 text-sm"
          : "space-y-3 bg-[var(--accent-soft)]/40 p-4 text-sm"
      }
      data-testid="withdrawal-breakdown"
    >
      {!compact ? (
        <p className="font-medium text-[var(--ink)]">
          Aportes confirmados há {windowDays} dias ou menos voltam{" "}
          <strong>integralmente</strong>. Sobre os confirmados há mais de {windowDays} dias{" "}
          {settled ? "foi descontada" : "será descontada"} a{" "}
          <strong>taxa administrativa de {feePct}%</strong>.
        </p>
      ) : null}
      <div className="space-y-2">
        <Row label={totalLabel} value={formatCentsBRL(totalPaidCents)} strong />
        <Row
          label={`Reembolso integral (até ${windowDays} dias)`}
          value={formatCentsBRL(full)}
        />
        <Row
          label={`Com desconto (há mais de ${windowDays} dias)`}
          value={formatCentsBRL(discounted)}
        />
        <div className="flex justify-between gap-3 text-[var(--danger)]">
          <span>Taxa administrativa ({feePct}% da parte com desconto)</span>
          <span className="font-semibold">− {formatCentsBRL(fee)}</span>
        </div>
        <div className="flex justify-between gap-3 border-t border-[var(--line)] pt-2">
          <span className="font-semibold text-[var(--ink)]">
            {settled ? "Você recebeu" : "Você receberá"}
          </span>
          <span className="text-lg font-bold text-[var(--accent)]">{formatCentsBRL(refund)}</span>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span className={strong ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]"}>{value}</span>
    </div>
  );
}
