"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCentsBRL } from "@/lib/utils";

export function CancelReservationButton({
  reservationId,
  amountPaidCents = 0,
  canCancel,
}: {
  reservationId: string;
  amountPaidCents?: number;
  /** When false, button disabled — reservation has aportes / paid balance */
  canCancel?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const allowed = canCancel ?? true;

  async function submit() {
    if (!allowed) return;

    const ok = window.confirm(
      amountPaidCents > 0
        ? "Cancelar esta reserva? Os aportes confirmados vão para a carteira e podem ser usados em outro aparelho ou sacados."
        : "Cancelar esta reserva? Esta ação não pode ser desfeita.",
    );
    if (!ok) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/reservations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Não foi possível cancelar.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={loading || !allowed}
        title="Cancelar reserva"
        onClick={() => void submit()}
      >
        {loading ? "Cancelando..." : "Cancelar reserva"}
      </Button>
      {amountPaidCents > 0 ? (
        <p className="max-w-[240px] text-xs text-[var(--ink-muted)]">
          {formatCentsBRL(amountPaidCents)} voltam para a carteira.
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[var(--danger)]">{message}</p>
      ) : null}
    </div>
  );
}
