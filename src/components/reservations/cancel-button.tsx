"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MotionModal } from "@/components/ui/motion";
import { formatCentsBRL } from "@/lib/utils";
import {
  CANCEL_COPY,
  cancelShouldSubmit,
  nextCancelStep,
  type CancelConfirmAction,
  type CancelConfirmStep,
} from "@/lib/reservations/cancel-confirm";

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
  const [step, setStep] = useState<CancelConfirmStep>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const allowed = canCancel ?? true;
  const loading = step === "submitting";

  const dispatch = useCallback((action: CancelConfirmAction) => {
    setStep((s) => nextCancelStep(s, action));
  }, []);
  const dismiss = useCallback(() => dispatch("dismiss"), [dispatch]);

  async function confirmFinal() {
    if (!allowed || !cancelShouldSubmit(step, "confirm")) return;
    dispatch("confirm");
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
        dispatch("failed");
        return;
      }
      dispatch("done");
      router.refresh();
    } catch {
      setMessage("Erro de rede. Tente novamente.");
      dispatch("failed");
    }
  }

  const titleId = `cancel-title-${reservationId}`;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={loading || !allowed}
        title="Cancelar reserva"
        onClick={() => {
          if (allowed) dispatch("open");
        }}
      >
        {loading ? CANCEL_COPY.submitting : "Cancelar reserva"}
      </Button>
      {amountPaidCents > 0 ? (
        <p className="max-w-[240px] text-xs text-[var(--ink-muted)]">
          {formatCentsBRL(amountPaidCents)} voltam para a carteira.
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[var(--danger)]">{message}</p>
      ) : null}

      <MotionModal open={step !== "idle"} onClose={dismiss} labelledBy={titleId}>
        <div className="space-y-4 p-6">
          {step === "warn" ? (
            <>
              <h2 id={titleId} className="text-lg font-semibold text-[var(--ink)]">
                {CANCEL_COPY.warnTitle}
              </h2>
              {amountPaidCents > 0 ? (
                <p className="text-sm text-[var(--ink)]">
                  {formatCentsBRL(amountPaidCents)} em aportes voltam para a carteira.
                </p>
              ) : null}
              <p className="text-sm text-[var(--ink-muted)]">
                {amountPaidCents > 0 ? CANCEL_COPY.warnWithAportes : CANCEL_COPY.warnNoAportes}
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => dispatch("continue")}>
                  {CANCEL_COPY.continue}
                </Button>
                <Button type="button" variant="primary" autoFocus onClick={dismiss}>
                  {CANCEL_COPY.keep}
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 id={titleId} className="text-lg font-semibold text-[var(--ink)]">
                {CANCEL_COPY.finalTitle}
              </h2>
              <p className="text-sm text-[var(--ink-muted)]">{CANCEL_COPY.finalBody}</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[var(--danger)] text-[var(--danger)]"
                  disabled={loading}
                  onClick={() => void confirmFinal()}
                >
                  {loading ? CANCEL_COPY.submitting : CANCEL_COPY.confirm}
                </Button>
                <Button type="button" variant="primary" autoFocus disabled={loading} onClick={dismiss}>
                  {CANCEL_COPY.back}
                </Button>
              </div>
            </>
          )}
        </div>
      </MotionModal>
    </div>
  );
}
