"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCentsBRL } from "@/lib/utils";
import { Gift } from "lucide-react";
import { RequestSaqueButton } from "@/components/withdrawals/request-saque-button";

export function ReferralBonusCard({
  balanceCents,
  activeReservations,
}: {
  balanceCents: number;
  activeReservations: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [reservationId, setReservationId] = useState(activeReservations[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (balanceCents <= 0) return null;

  async function apply() {
    if (!reservationId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/referrals/apply-bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Não foi possível aplicar o bônus.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-[var(--accent-soft)] bg-[var(--accent-soft)]/40">
      <div className="flex items-start gap-3">
        <Gift className="mt-1 h-6 w-6 text-[var(--accent)]" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-lg font-bold">Bônus de indicação</h3>
            <p className="text-sm text-[var(--ink-muted)]">
              Você tem {formatCentsBRL(balanceCents)} para direcionar a um aporte ativo.
            </p>
          </div>
          {activeReservations.length > 0 ? (
            <>
              <Select
                label="Reserva"
                value={reservationId}
                onChange={(e) => setReservationId(e.target.value)}
              >
                {activeReservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
              <Button type="button" disabled={loading} onClick={() => void apply()}>
                {loading ? "Aplicando…" : "Aplicar bônus na reserva"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">
              Crie uma reserva ativa para usar o bônus.
            </p>
          )}
          <div className="border-t border-[var(--line)] pt-3">
            <p className="mb-2 text-xs text-[var(--ink-muted)]">
              Prefere sacar? O bônus só sai via Pix com aprovação do admin.
            </p>
            <RequestSaqueButton mode="bonus" bonusCents={balanceCents} size="sm" />
          </div>
          {message ? <p className="text-sm text-[var(--danger)]">{message}</p> : null}
        </div>
      </div>
    </Card>
  );
}
