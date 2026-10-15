"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCentsBRL } from "@/lib/utils";
import type { UsedDeviceOffer } from "@/lib/trade-in/types";
import { isCounterOffer, isDiscardedOffer, isExpiredOffer } from "@/lib/trade-in/offer-state";

export function TradeInClientActions({
  offer,
  amountPaidCents,
}: {
  offer: UsedDeviceOffer;
  amountPaidCents: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reais, setReais] = useState((offer.expected_value_cents / 100).toFixed(2));

  async function send(action: "accept" | "reject" | "resubmit" | "discard", expectedCents?: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-in/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, action, expectedCents }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível atualizar a avaliação.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  const counter = isCounterOffer(offer);
  const expired = isExpiredOffer(offer);
  const discarded = isDiscardedOffer(offer);

  return (
    <div className="space-y-3">
      {counter && offer.approved_value_cents ? (
        <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-[var(--ink)]">
            Contra-proposta: {formatCentsBRL(offer.approved_value_cents)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="accent" size="sm" disabled={loading} onClick={() => void send("accept")}>
              Aceitar
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void send("reject")}>
              Recusar
            </Button>
          </div>
        </div>
      ) : null}

      {offer.status === "rejected" ? (
        <div className="space-y-2">
          <Input
            label="Novo valor proposto (R$)"
            value={reais}
            onChange={(e) => setReais(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              const n = Number(reais.replace(/\./g, "").replace(",", "."));
              void send("resubmit", Math.round(n * 100));
            }}
          >
            Reenviar esta avaliação
          </Button>
        </div>
      ) : null}

      {expired && !discarded ? (
        <div className="space-y-2 rounded-2xl border border-red-300 bg-red-50 p-3">
          <p className="text-sm text-[var(--ink)]">
            O crédito de {formatCentsBRL(offer.approved_value_cents ?? 0)} venceu em 90 dias
            sem a reserva chegar a 100%. Faça uma reavaliação com fotos novas ou descarte este valor.
          </p>
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void send("discard")}>
            Descartar avaliação
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <span className="sr-only">{formatCentsBRL(amountPaidCents)}</span>
    </div>
  );
}
