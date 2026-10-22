"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialAporteBrl } from "@/lib/goals/aporte-prefill";
import { formatCentsBRL } from "@/lib/utils";

type PixPayload = {
  copy_paste: string;
  qr_base64: string;
  charge_id: string;
  provider: string;
};

export function GerarPixForm({
  reservationId,
  remainingCents,
  prefillCents = 0,
  disabled,
  simulationEnabled = false,
}: {
  reservationId: string;
  remainingCents: number;
  /** "Fazer aporte" da meta: parcela da meta em centavos (?aporte=). Editável. */
  prefillCents?: number;
  disabled?: boolean;
  /** Servidor: ALLOW_PAYMENT_SIMULATION=true ou modo mock. Mostra "Pago (teste)". */
  simulationEnabled?: boolean;
}) {
  const router = useRouter();
  const [amountBrl, setAmountBrl] = useState(() => initialAporteBrl(prefillCents, remainingCents));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pix, setPix] = useState<PixPayload | null>(null);
  const [payment, setPayment] = useState<{
    contributionId: string;
    amountCents: number;
  } | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (disabled || remainingCents <= 0) return;
    setMessage(null);
    setPix(null);
    setPayment(null);
    setConfirmed(false);
    setCopied(false);
    void generate();
  }

  async function generate() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pix/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          amount_brl: amountBrl,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        gateway_configured?: boolean;
        pix?: PixPayload | null;
        amount_cents?: number;
        contribution_id?: string;
      };
      if (!res.ok || !data.ok || !data.contribution_id) {
        setMessage(data.error ?? "Não foi possível gerar o Pix.");
        return;
      }
      setPayment({
        contributionId: data.contribution_id,
        amountCents: data.amount_cents ?? 0,
      });
      if (data.pix?.copy_paste) setPix(data.pix);
      setMessage(
        data.amount_cents
          ? `Aporte de ${formatCentsBRL(data.amount_cents)} criado. Pague o Pix para confirmar.`
          : "Aporte criado. Pague o Pix para confirmar.",
      );
      router.refresh();
    } catch {
      setMessage("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function advancePayment() {
    if (!payment) return;
    setAdvancing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dev/simulate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contribution_id: payment.contributionId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Não foi possível confirmar o aporte.");
        return;
      }
      setPix(null);
      setPayment(null);
      setConfirmed(true);
      setMessage("Aporte confirmado. O saldo da reserva foi atualizado.");
      router.refresh();
    } catch {
      setMessage("Erro de rede. Tente novamente.");
    } finally {
      setAdvancing(false);
    }
  }

  async function copyCode() {
    if (!pix?.copy_paste) return;
    try {
      await navigator.clipboard.writeText(pix.copy_paste);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <Input
          label="Valor do aporte (R$)"
          hint={`Mínimo R$ 5,00 · restante ${formatCentsBRL(remainingCents)}`}
          name="amount_brl"
          inputMode="decimal"
          value={amountBrl}
          onChange={(e) => setAmountBrl(e.target.value)}
          disabled={disabled || loading || advancing}
        />
        <Button
          type="submit"
          variant="accent"
          disabled={disabled || loading || advancing || remainingCents <= 0}
          fullWidth
        >
          {loading ? "Gerando Pix..." : "Gerar Pix"}
        </Button>
      </form>

      {message ? (
        <p
          className={`text-sm ${
            payment || pix || confirmed ? "text-[var(--ink)]" : "text-[var(--danger)]"
          }`}
        >
          {message}
        </p>
      ) : null}

      {payment ? (
        <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-subtle)] p-4">
          <p className="text-sm font-semibold text-[var(--ink)]">
            Pix do aporte
            {payment.amountCents
              ? ` · ${formatCentsBRL(payment.amountCents)}`
              : ""}
          </p>
          <p className="text-xs text-[var(--ink-muted)]">
            {pix?.copy_paste
              ? "Escaneie o QR Code ou copie o código no app do seu banco. A confirmação chega sozinha."
              : "O Pix ainda não foi gerado no gateway."}
          </p>
          {pix?.qr_base64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                pix.qr_base64.startsWith("data:")
                  ? pix.qr_base64
                  : `data:image/png;base64,${pix.qr_base64}`
              }
              alt="QR Code Pix"
              className="mx-auto h-48 w-48 rounded-xl bg-white p-2"
            />
          ) : null}
          {pix?.copy_paste ? (
            <p className="break-all text-xs text-[var(--ink-muted)]">
              {pix.copy_paste}
            </p>
          ) : null}
          {pix?.copy_paste ? (
            <Button type="button" variant="outline" onClick={() => void copyCode()}>
              {copied ? "Copiado!" : "Copiar código Pix"}
            </Button>
          ) : null}
          {simulationEnabled ? (
            <Button
              type="button"
              variant="accent"
              fullWidth
              disabled={advancing}
              data-testid="pix-simulate-paid"
              onClick={() => void advancePayment()}
            >
              {advancing ? "Confirmando..." : "Pago (teste)"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
