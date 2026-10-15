"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCentsBRL } from "@/lib/utils";
import type { ReferralWithReferred } from "@/lib/referrals/types";
import { referralActivated } from "@/lib/referrals/status";
import { CheckCircle2, Copy, Gift, Share2 } from "lucide-react";

export function IndicacoesPanel({
  referralCode,
  referredBy,
  referrals,
  bonusCents,
  origin,
}: {
  referralCode: string | null;
  referredBy: string | null;
  referrals: ReferralWithReferred[];
  bonusCents: number;
  origin: string;
}) {
  const router = useRouter();
  const [copying, setCopying] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shareLink = useMemo(() => {
    const base = origin || "";
    const c = referralCode || "";
    return `${base}/criar-conta?ref=${encodeURIComponent(c)}`;
  }, [origin, referralCode]);

  const totalEarned = referrals
    .filter((r) => r.bonus_credited)
    .reduce((s, r) => s + r.bonus_amount_cents, 0);
  const pendingCount = referrals.filter((r) => !r.bonus_credited).length;
  const completedCount = referrals.filter((r) => r.bonus_credited).length;

  async function handleCopy() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {
      /* ignore */
    }
    setTimeout(() => setCopying(false), 1600);
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "iPlanet Pay — Indicações",
          text: `Use meu código ${referralCode} e ganhe benefícios no iPlanet Pay!`,
          url: shareLink,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    await handleCopy();
  }

  async function applyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/referrals/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível aplicar o código.");
        return;
      }
      setMessage("Código aplicado! O bônus é creditado após o primeiro aporte confirmado.");
      setCode("");
      router.refresh();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/10 to-transparent">
        <p className="text-sm text-[var(--ink-muted)]">Seu código de indicação</p>
        <p className="mt-2 text-center text-3xl font-bold tracking-[0.2em] text-[var(--accent)]">
          {referralCode ?? "…"}
        </p>
        <p className="mt-3 text-center text-sm text-[var(--ink-muted)]">
          Ganhe {formatCentsBRL(bonusCents)} quando o indicado confirmar{" "}
          <strong className="text-[var(--ink)]">R$ 100,00</strong> ou mais em aportes.
          O bônus aparece na home para você direcionar a uma reserva ativa.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => void handleCopy()}
            leftIcon={
              copying ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )
            }
          >
            {copying ? "Copiado!" : "Copiar link"}
          </Button>
          <Button
            type="button"
            variant="accent"
            className="flex-1"
            onClick={() => void handleShare()}
            leftIcon={<Share2 className="h-4 w-4" />}
          >
            Compartilhar
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Indicados", value: String(referrals.length) },
          { label: "Bônus creditados", value: String(completedCount) },
          { label: "Total ganho", value: formatCentsBRL(totalEarned) },
        ].map((s) => (
          <Card key={s.label} className="bg-white">
            <p className="text-sm text-[var(--ink-muted)]">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
          </Card>
        ))}
      </div>

      {!referredBy ? (
        <Card>
          <h2 className="text-lg font-bold tracking-tight">Tem um código?</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Aplique uma única vez. Você não pode usar o próprio código.
          </p>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={applyCode}>
            <Input
              name="code"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="uppercase tracking-widest"
            />
            <Button type="submit" variant="accent" disabled={loading || !code.trim()}>
              {loading ? "Aplicando…" : "Aplicar"}
            </Button>
          </form>
          {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
          {message ? <p className="mt-2 text-sm text-[var(--accent)]">{message}</p> : null}
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-[var(--ink-muted)]">
            Você já usou um código de indicação. O indicador recebe o bônus após seu primeiro
            aporte confirmado.
          </p>
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">Suas indicações</h2>
          {pendingCount > 0 ? <Pill tone="lavender">{pendingCount} pendentes</Pill> : null}
        </div>
        {referrals.length === 0 ? (
          <EmptyState
            icon={<Gift className="h-6 w-6" />}
            title="Nenhuma indicação ainda"
            description="Compartilhe seu link e acompanhe o status aqui."
          />
        ) : (
          <div className="space-y-3">
            {referrals.map((r) => (
              <Card key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {r.referred?.full_name?.trim() || "Indicado"}
                  </p>
                  <p className="text-sm text-[var(--ink-muted)]">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")} ·{" "}
                    {formatCentsBRL(r.bonus_amount_cents)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <span
                    className={
                      referralActivated(r.confirmed_cents ?? 0, r.bonus_credited)
                        ? "h-2.5 w-2.5 rounded-full bg-[#1f8a4c]"
                        : "h-2.5 w-2.5 rounded-full bg-[#f5b942]"
                    }
                  />
                  {referralActivated(r.confirmed_cents ?? 0, r.bonus_credited)
                    ? "Ativado · R$ 100"
                    : "Conta criada"}
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
