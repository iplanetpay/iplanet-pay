"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCentsBRL } from "@/lib/utils";
import { PIX_KEY_TYPE_LABEL, type PixKeyType } from "@/lib/withdrawals/types";
import type { ReservationWithDetails } from "@/lib/reservations/types";

export function WalletActions({
  balanceCents,
  reservations,
}: {
  balanceCents: number;
  reservations: ReservationWithDetails[];
}) {
  const router = useRouter();
  const active = reservations.filter((r) => r.status === "ativa");
  const [reservationId, setReservationId] = useState(active[0]?.id ?? "");
  const [applyReais, setApplyReais] = useState("");
  const [withdrawReais, setWithdrawReais] = useState((balanceCents / 100).toFixed(2));
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState<PixKeyType>("cpf");
  const [holder, setHolder] = useState("");
  const [cpf, setCpf] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feeNote, setFeeNote] = useState<string | null>(null);

  function reaisToCents(value: string) {
    const n = Number(value.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }

  async function applyBalance() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/wallet/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          amount_cents: reaisToCents(applyReais),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível aplicar o saldo.");
        return;
      }
      setMessage("Saldo aplicado na reserva.");
      setApplyReais("");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function withdraw() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setFeeNote(null);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: reaisToCents(withdrawReais),
          pix_key: pixKey,
          pix_key_type: pixType,
          holder_full_name: holder,
          holder_cpf: cpf,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        fee_amount_cents?: number;
        refund_amount_cents?: number;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível solicitar o saque.");
        return;
      }
      setFeeNote(
        `Saque solicitado. A taxa de 30% (${formatCentsBRL(data.fee_amount_cents ?? 0)}) foi descontada. Você recebe ${formatCentsBRL(data.refund_amount_cents ?? 0)} no Pix depois da aprovação.`,
      );
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  if (balanceCents <= 0 && !feeNote) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-white p-4">
        <h2 className="text-lg font-bold">Usar saldo em uma reserva</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Disponível: {formatCentsBRL(balanceCents)}. Vale para uma reserva nova ou em andamento.
        </p>
        <Select
          label="Reserva"
          value={reservationId}
          onChange={(e) => setReservationId(e.target.value)}
        >
          {active.length === 0 ? <option value="">Nenhuma reserva ativa</option> : null}
          {active.map((r) => (
            <option key={r.id} value={r.id}>
              {r.product?.name ?? "Reserva"}
            </option>
          ))}
        </Select>
        <Input label="Valor (R$)" value={applyReais} onChange={(e) => setApplyReais(e.target.value)} />
        <Button type="button" variant="accent" disabled={loading || !reservationId} onClick={() => void applyBalance()}>
          Aplicar na reserva
        </Button>
      </div>

      <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-white p-4">
        <h2 className="text-lg font-bold">Sacar saldo</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Mínimo R$ 1.000,00. Ao solicitar, 30% fica com a plataforma e 70% segue para o Pix.
        </p>
        <Input label="Valor (R$)" value={withdrawReais} onChange={(e) => setWithdrawReais(e.target.value)} />
        <Select label="Tipo da chave" value={pixType} onChange={(e) => setPixType(e.target.value as PixKeyType)}>
          {Object.entries(PIX_KEY_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input label="Chave Pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
        <Input label="Titular" value={holder} onChange={(e) => setHolder(e.target.value)} />
        <Input label="CPF do titular" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        <Button type="button" variant="outline" disabled={loading} onClick={() => void withdraw()}>
          Solicitar saque
        </Button>
        {feeNote ? <p className="text-sm font-medium text-[var(--ink)]">{feeNote}</p> : null}
      </div>

      {error ? <p className="text-sm text-[var(--danger)] lg:col-span-2">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--accent)] lg:col-span-2">{message}</p> : null}
    </div>
  );
}
