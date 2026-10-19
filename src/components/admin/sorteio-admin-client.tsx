"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RaffleDrawStage, type RaffleDrawEntry } from "@/components/admin/raffle-draw-stage";
import { Pill } from "@/components/ui/pill";
import type { RaffleAdminState } from "@/lib/raffle/queries";
import type { RaffleResetState } from "@/lib/raffle/utils";

function resetDescription(state: RaffleResetState) {
  switch (state.kind) {
    case "awaiting_draw":
      return "Disponível depois que o sorteio for realizado.";
    case "ready":
      return "Sorteio realizado. Zere as fichas de todos os clientes para começar o próximo ciclo.";
    case "reset":
      return "Fichas zeradas. Se foi um engano, reverta para restaurar exatamente as fichas anteriores.";
    default: {
      const unhandled: never = state;
      return unhandled;
    }
  }
}

export function SorteioAdminClient({
  entries,
  admin,
}: {
  entries: RaffleDrawEntry[];
  admin: RaffleAdminState;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [busy, setBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [lastWinner, setLastWinner] = useState<{ userId: string; name: string } | null>(
    null,
  );

  async function persistWinner(w: { userId: string; name: string }) {
    setLastWinner(w);
    const entry = entries.find((e) => e.userId === w.userId);
    const pool = entries.reduce((s, e) => s + e.tickets, 0);
    try {
      await fetch("/api/admin/raffle/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winner_user_id: w.userId,
          winner_name: w.name,
          winner_tickets: entry?.tickets ?? 0,
          total_tickets_pool: pool,
        }),
      });
      startRefresh(() => router.refresh());
    } catch {
      /* non-blocking for live show */
    }
  }

  async function sendReset(body: { action: "reset" } | { action: "revert"; reset_id: string }) {
    setBusy(true);
    setResetError(null);
    try {
      const res = await fetch("/api/admin/raffle/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setResetError(json?.error ?? "Não foi possível concluir.");
        return;
      }
      startRefresh(() => router.refresh());
    } catch {
      setResetError("Falha de rede. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function zerarFichas() {
    const ok = window.confirm(
      "Zerar as fichas de TODOS os clientes? Você poderá reverter logo em seguida.",
    );
    if (ok) void sendReset({ action: "reset" });
  }

  const { state, activeReset } = admin;
  const working = busy || refreshing;

  return (
    <div className="space-y-8">
      <RaffleDrawStage entries={entries} onComplete={(w) => void persistWinner(w)} />

      {lastWinner ? (
        <Card className="text-center">
          <p className="text-sm text-[var(--ink-muted)]">Último sorteado</p>
          <p className="text-xl font-bold">{lastWinner.name}</p>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Zerar fichas</h2>
          <p className="text-sm text-[var(--ink-muted)]">{resetDescription(state)}</p>
          {state.kind === "reset" && activeReset ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Zeradas em {new Date(activeReset.createdAt).toLocaleString("pt-BR")} ·{" "}
              {activeReset.totalTickets} fichas de {activeReset.usersCount} clientes
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="primary"
            leftIcon={<Ticket className="h-4 w-4" />}
            disabled={state.kind !== "ready" || working}
            onClick={zerarFichas}
          >
            Zerar Fichas
          </Button>
          {state.kind === "reset" ? (
            <Button
              type="button"
              variant="outline"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              disabled={working}
              onClick={() => void sendReset({ action: "revert", reset_id: state.resetId })}
            >
              Reverter
            </Button>
          ) : null}
        </div>
        {resetError ? <p className="text-sm text-[var(--danger)]">{resetError}</p> : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Ranking de fichas</h2>
        <ul className="divide-y divide-[var(--line)]">
          {entries.slice(0, 30).map((e, i) => (
            <li key={e.userId} className="flex items-center justify-between py-2 text-sm">
              <span>
                #{i + 1} {e.name}
              </span>
              <Pill tone="lavender">{e.tickets}</Pill>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
