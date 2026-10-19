"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MotionModal } from "@/components/ui/motion";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCentsBRL } from "@/lib/utils";
import {
  PAYOUT_STATUS_LABEL,
  WITHDRAWAL_STATUS_LABEL,
  type WithdrawalPayoutStatus,
  type WithdrawalStatus,
} from "@/lib/withdrawals/types";
import type { WithdrawalWithDetails } from "@/lib/withdrawals/queries";
import { Wallet } from "lucide-react";

export function AdminSaquesPanel({
  items,
  pendingCount,
  pendingRefundSumCents,
  highlightId,
}: {
  items: WithdrawalWithDetails[];
  pendingCount: number;
  pendingRefundSumCents: number;
  highlightId?: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!highlightId) return;
    document
      .getElementById(`saque-${highlightId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);
  const [active, setActive] = useState<WithdrawalWithDetails | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function openModal(item: WithdrawalWithDetails, act: "approve" | "reject") {
    setActive(item);
    setAction(act);
    setPassword("");
    setNotes("");
    setMessage(null);
  }

  async function submit() {
    if (!active || !action) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/withdrawals/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: active.id,
          action,
          password,
          adminNotes: notes || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Falha ao processar.");
        return;
      }
      setActive(null);
      setAction(null);
      router.refresh();
    } catch {
      setMessage("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Saques</h2>
        <Card className="bg-white px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">
            Reembolsos pendentes
          </p>
          <p className="text-lg font-bold">
            {pendingCount} · {formatCentsBRL(pendingRefundSumCents)}
          </p>
        </Card>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="Nenhuma solicitação de saque"
          description="Quando clientes solicitarem saque de aportes, aparecerão aqui."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <ul className="divide-y divide-[var(--line)]">
            {items.map((w) => (
              <li
                key={w.id}
                id={`saque-${w.id}`}
                aria-current={w.id === highlightId ? "true" : undefined}
                className={`scroll-mt-24 space-y-2 px-4 py-4 sm:px-5 ${
                  w.id === highlightId
                    ? "bg-[var(--accent-soft)]/60 ring-2 ring-inset ring-[var(--accent)]"
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {w.client_name ?? "Cliente"} ·{" "}
                      {w.product_name ?? "Produto"}
                    </p>
                    <p className="text-sm text-[var(--ink-muted)]">
                      {new Date(w.created_at).toLocaleString("pt-BR")} ·{" "}
                      {WITHDRAWAL_STATUS_LABEL[w.status as WithdrawalStatus] ??
                        w.status}{" "}
                      · payout{" "}
                      {PAYOUT_STATUS_LABEL[
                        w.payout_status as WithdrawalPayoutStatus
                      ] ?? w.payout_status}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p>
                      Total {formatCentsBRL(w.total_paid_cents)} · taxa{" "}
                      {formatCentsBRL(w.fee_amount_cents)}
                    </p>
                    <p className="font-bold text-[var(--accent)]">
                      Receber {formatCentsBRL(w.refund_amount_cents)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[var(--ink-muted)] [overflow-wrap:anywhere]">
                  <span className="uppercase">{w.pix_key_type}</span>:{" "}
                  <span className="font-mono text-[var(--ink)]">{w.pix_key}</span>
                  {" · "}
                  {w.holder_full_name} · CPF {w.holder_cpf}
                </p>
                {w.admin_notes ? (
                  <p className="text-xs text-[var(--ink-muted)]">
                    Nota: {w.admin_notes}
                  </p>
                ) : null}
                {w.status === "pending" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => openModal(w, "approve")}
                    >
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openModal(w, "reject")}
                    >
                      Rejeitar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <MotionModal
        open={!!active && !!action}
        onClose={() => !loading && setActive(null)}
        labelledBy="process-saque-title"
      >
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 id="process-saque-title" className="text-lg font-bold">
            {action === "approve" ? "Aprovar saque" : "Rejeitar saque"}
          </h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          {active ? (
            <p className="text-sm text-[var(--ink-muted)]">
              {active.client_name} · reembolso{" "}
              <strong className="text-[var(--ink)]">
                {formatCentsBRL(active.refund_amount_cents)}
              </strong>
              . Informe a senha de confirmação.
            </p>
          ) : null}
          <Input
            label="Senha de confirmação"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••"
            autoComplete="off"
            required
          />
          <Textarea
            label="Nota (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: comprovante, observação"
            rows={3}
          />
          {message ? (
            <p className="text-sm text-[var(--danger)]">{message}</p>
          ) : null}
        </div>
        <div className="flex gap-2 border-t border-[var(--line)] px-5 py-4">
          <Button
            variant="outline"
            fullWidth
            disabled={loading}
            onClick={() => setActive(null)}
          >
            Cancelar
          </Button>
          <Button
            fullWidth
            disabled={loading || !password}
            onClick={() => void submit()}
          >
            {loading ? "Processando..." : "Confirmar"}
          </Button>
        </div>
      </MotionModal>
    </section>
  );
}
