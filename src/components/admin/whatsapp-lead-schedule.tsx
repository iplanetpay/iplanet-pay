"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import {
  scheduleKindLabel,
  scheduleStatusLabel,
  type GoalScheduleListItem,
  type GoalScheduleStatus,
} from "@/lib/goals/whatsapp-schedule";
import { formatPlanDate } from "@/lib/reservations/contribution-plan";

function statusTone(status: GoalScheduleStatus): "success" | "accent" | "danger" | "neutral" {
  switch (status) {
    case "sent":
      return "success";
    case "pending":
      return "accent";
    case "failed":
      return "danger";
    case "cancelled":
      return "neutral";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Status de aviso inválido: ${String(_exhaustive)}`);
    }
  }
}

function ScheduleList({ title, rows }: { title: string; rows: GoalScheduleListItem[] }) {
  return (
    <section>
      <h3 className="text-sm font-semibold">
        {title} <span className="text-[var(--ink-muted)]">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--ink-muted)]">Nada por aqui.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--line)] text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">
                  {formatPlanDate(row.send_on)} · {scheduleKindLabel(row.kind)}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {row.goal_name} · aporte de {formatPlanDate(row.due_date)}
                  {row.sent_at
                    ? ` · enviado ${new Date(row.sent_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                    : ""}
                  {row.error ? ` · ${row.error}` : ""}
                </p>
              </div>
              <Pill tone={statusTone(row.status)}>{scheduleStatusLabel(row.status)}</Pill>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WhatsappLeadSchedule({
  lead,
  onClose,
}: {
  lead: { user_id: string; full_name: string; phone: string };
  onClose: () => void;
}) {
  const [rows, setRows] = useState<GoalScheduleListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    fetch(`/api/admin/whatsapp/schedule?user_id=${encodeURIComponent(lead.user_id)}`)
      .then((res) => res.json() as Promise<{ ok?: boolean; error?: string; rows?: GoalScheduleListItem[] }>)
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setRows(data.rows ?? []);
        else setError(data.error ?? "Falha ao carregar.");
      })
      .catch(() => {
        if (!cancelled) setError("Erro de rede.");
      });
    return () => {
      cancelled = true;
    };
  }, [lead.user_id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pending = (rows ?? []).filter((row) => row.status === "pending");
  const done = (rows ?? []).filter((row) => row.status !== "pending").reverse();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label={`Programação de ${lead.full_name}`}
      onClick={onClose}
    >
      <Card className="w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{lead.full_name}</h2>
            <p className="text-sm text-[var(--ink-muted)]">{lead.phone} · programação de disparos das metas</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
        {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
        {rows == null && !error ? (
          <p className="mt-4 text-sm text-[var(--ink-muted)]">Carregando…</p>
        ) : null}
        {rows != null ? (
          rows.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--ink-muted)]">Este cliente não tem avisos de metas.</p>
          ) : (
            <div className="mt-4 space-y-6">
              <ScheduleList title="Programadas" rows={pending} />
              <ScheduleList title="Enviadas e encerradas" rows={done} />
            </div>
          )
        ) : null}
      </Card>
    </div>
  );
}
