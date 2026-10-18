"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MotionModal } from "@/components/ui/motion";
import {
  APORTE_CONTRACT_TEXT,
  APORTE_CONTRACT_VERSION,
} from "@/lib/aportes/contract";
import { collectDeviceFingerprint } from "@/lib/aportes/fingerprint";

export function AporteContractModal({
  open,
  reservationId,
  onClose,
  onAccepted,
}: {
  open: boolean;
  reservationId: string;
  onClose: () => void;
  onAccepted: (contractId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReachedEnd(false);
    setChecked(false);
    setMessage(null);
    const frame = window.requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      if (el.scrollHeight - el.clientHeight <= 24) setReachedEnd(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el || reachedEnd) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setReachedEnd(true);
    }
  }

  async function accept() {
    if (!reachedEnd || !checked) return;
    setLoading(true);
    setMessage(null);
    try {
      const fingerprint = await collectDeviceFingerprint();
      const res = await fetch("/api/aportes/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          contract_version: APORTE_CONTRACT_VERSION,
          scrolled_to_end: true,
          fingerprint,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !data.ok || !data.id) {
        setMessage(data.error ?? "Não foi possível registrar o aceite.");
        return;
      }
      onAccepted(data.id);
    } catch {
      setMessage("Erro de rede ao registrar o contrato.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MotionModal
      open={open}
      onClose={onClose}
      labelledBy="aporte-contract-title"
      className="max-w-xl"
    >
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Antes do aporte
          </p>
          <h2 id="aporte-contract-title" className="text-xl font-bold tracking-tight">
            Contrato do aporte
          </h2>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-[var(--ink-muted)]"
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="mx-5 max-h-[46dvh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-3 text-sm leading-relaxed text-[var(--ink)]"
      >
        {APORTE_CONTRACT_TEXT}
      </div>
      <div className="space-y-3 px-5 py-4">
        <p className="text-xs text-[var(--ink-muted)]">
          {reachedEnd
            ? "Fim do contrato alcançado. Marque o aceite para continuar."
            : "Role até o fim do contrato para liberar o aceite."}
        </p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={checked}
            disabled={!reachedEnd || loading}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>Li o contrato até o fim e aceito iniciar este aporte.</span>
        </label>
        {message ? <p className="text-sm text-[var(--danger)]">{message}</p> : null}
        <Button
          type="button"
          variant="accent"
          fullWidth
          disabled={!reachedEnd || !checked || loading}
          onClick={() => void accept()}
        >
          {loading ? "Registrando aceite..." : "Aceitar e gerar Pix"}
        </Button>
      </div>
    </MotionModal>
  );
}
