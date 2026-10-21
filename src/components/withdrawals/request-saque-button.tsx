"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MotionModal } from "@/components/ui/motion";
import {
  PIX_KEY_TYPE_LABEL,
  type PixKeyType,
} from "@/lib/withdrawals/types";
import { Wallet } from "lucide-react";
import { formatCentsBRL } from "@/lib/utils";
import type { WithdrawalSplit } from "@/lib/withdrawals/fee-window";
import { WithdrawalFeeBreakdown } from "@/components/withdrawals/withdrawal-fee-breakdown";

export function RequestSaqueButton({
  reservationId,
  size = "md",
  mode = "reserva",
  bonusCents = 0,
}: {
  reservationId?: string;
  size?: "sm" | "md" | "lg";
  /** "bonus": saque do bônus de indicação, sempre com aprovação do admin. */
  mode?: "reserva" | "bonus";
  bonusCents?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf");
  const [holderName, setHolderName] = useState("");
  const [holderCpf, setHolderCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [split, setSplit] = useState<WithdrawalSplit | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || mode !== "reserva" || !reservationId) return;
    let ignore = false;
    setSplit(null);
    setSplitError(null);
    void fetch(`/api/withdrawals/preview?reservation_id=${encodeURIComponent(reservationId)}`)
      .then((r) => r.json() as Promise<{ ok?: boolean; split?: WithdrawalSplit; error?: string }>)
      .then((d) => {
        if (ignore) return;
        if (d.ok && d.split) setSplit(d.split);
        else setSplitError(d.error ?? "Não foi possível calcular o saque.");
      })
      .catch(() => {
        if (!ignore) setSplitError("Erro de rede ao calcular o saque.");
      });
    return () => {
      ignore = true;
    };
  }, [open, mode, reservationId]);

  async function submit() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        mode === "bonus" ? "/api/referrals/withdraw-bonus" : "/api/withdrawals/request",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "reserva" ? { reservation_id: reservationId } : {}),
          pix_key: pixKey,
          pix_key_type: pixKeyType,
          holder_full_name: holderName,
          holder_cpf: holderCpf,
        }),
        },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Não foi possível solicitar o saque.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setMessage("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    pixKey.trim().length > 0 &&
    holderName.trim().length > 0 &&
    holderCpf.replace(/\D/g, "").length === 11 &&
    !loading;

  return (
    <>
      <div className="flex w-full flex-col items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size={size}
          leftIcon={<Wallet className="h-4 w-4" />}
          onClick={() => setOpen(true)}
        >
          {mode === "bonus" ? "Sacar bônus" : "Solicitar saque"}
        </Button>
      </div>

      <MotionModal
        open={open}
        onClose={() => !loading && setOpen(false)}
        labelledBy="saque-title"
        className="max-w-lg"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 id="saque-title" className="text-lg font-bold tracking-tight">
            {mode === "bonus" ? "Sacar bônus de indicação" : "Solicitar saque"}
          </h2>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--ink-muted)]"
            onClick={() => !loading && setOpen(false)}
          >
            Fechar
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-sm text-[var(--ink-muted)]">
            O Pix do reembolso é efetuado em até <strong>24h</strong> após a
            aprovação no Financeiro.
          </p>
          {mode === "bonus" ? (
            <p className="rounded-[var(--radius-card)] bg-amber-50 p-3 text-sm text-amber-900">
              Bônus de indicação de <strong>{formatCentsBRL(bonusCents)}</strong>, sem taxa. O
              saque do bônus <strong>só sai com aprovação do admin</strong> na tela Saques; o
              valor fica retido até a análise e volta para você se o pedido for rejeitado.
            </p>
          ) : split ? (
            <WithdrawalFeeBreakdown
              totalPaidCents={split.totalCents}
              feePct={split.feePct}
              feeAmountCents={split.feeCents}
              refundAmountCents={split.netCents}
              fullRefundCents={split.fullRefundCents}
              discountedCents={split.discountedCents}
              windowDays={split.windowDays}
            />
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">
              {splitError ?? "Calculando o valor do saque…"}
            </p>
          )}

          <Select
            label="Tipo da chave Pix"
            value={pixKeyType}
            onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
          >
            {(Object.keys(PIX_KEY_TYPE_LABEL) as PixKeyType[]).map((k) => (
              <option key={k} value={k}>
                {PIX_KEY_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
          <Input
            label="Chave Pix"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder={
              pixKeyType === "cpf"
                ? "000.000.000-00"
                : pixKeyType === "email"
                  ? "voce@email.com"
                  : pixKeyType === "phone"
                    ? "(11) 99999-9999"
                    : "Chave aleatória"
            }
            required
          />
          <Input
            label="Nome completo do titular"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="Nome como no banco"
            required
          />
          <Input
            label="CPF do titular"
            value={holderCpf}
            onChange={(e) => setHolderCpf(e.target.value)}
            placeholder="000.000.000-00"
            required
          />
          {message ? (
            <p className="text-sm text-[var(--danger)]">{message}</p>
          ) : null}
        </div>
        <div className="border-t border-[var(--line)] px-5 py-4">
          <Button
            type="button"
            fullWidth
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {loading ? "Enviando..." : "Confirmar saque"}
          </Button>
        </div>
      </MotionModal>
    </>
  );
}
