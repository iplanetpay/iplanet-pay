"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_GOAL_NOTICE_BODIES,
  GOAL_NOTICE_TEMPLATE_NAMES,
  GOAL_SCHEDULE_KINDS,
  isGoalNoticeTemplate,
  renderGoalNotice,
  scheduleKindLabel,
  type GoalScheduleKind,
} from "@/lib/goals/whatsapp-schedule";
import { addCalendarDays, calendarToday } from "@/lib/reservations/contribution-plan";
import type { WhatsappTemplate } from "@/types/database";

function noticeHint(kind: GoalScheduleKind): string {
  switch (kind) {
    case "day_before":
      return "Sai na véspera de cada data de aporte.";
    case "late":
      return "Sai no dia seguinte à data, só se o aporte não foi feito.";
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Tipo de aviso inválido: ${String(_exhaustive)}`);
    }
  }
}

export function WhatsappGoalNotices({
  templates,
  onSaved,
}: {
  templates: WhatsappTemplate[];
  onSaved: (template: WhatsappTemplate) => void;
}) {
  const templateFor = (kind: GoalScheduleKind) =>
    templates.find((template) => isGoalNoticeTemplate(template.name, kind)) ?? null;
  const [bodies, setBodies] = useState<Record<GoalScheduleKind, string>>(() => ({
    day_before: templateFor("day_before")?.body ?? DEFAULT_GOAL_NOTICE_BODIES.day_before,
    late: templateFor("late")?.body ?? DEFAULT_GOAL_NOTICE_BODIES.late,
  }));
  const [saving, setSaving] = useState<GoalScheduleKind | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const sampleDue = addCalendarDays(calendarToday(), 1);

  async function save(kind: GoalScheduleKind) {
    const current = templateFor(kind);
    const body = bodies[kind];
    setSaving(kind);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/whatsapp/templates", {
        method: current ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          current
            ? { id: current.id, body }
            : { name: GOAL_NOTICE_TEMPLATE_NAMES[kind], kind: "cobranca", body },
        ),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; id?: string };
      if (!res.ok || !data.ok) {
        setFeedback({ error: true, text: data.error ?? "Falha ao salvar." });
        return;
      }
      onSaved(
        current
          ? { ...current, body }
          : {
              id: data.id ?? GOAL_NOTICE_TEMPLATE_NAMES[kind],
              name: GOAL_NOTICE_TEMPLATE_NAMES[kind],
              kind: "cobranca",
              body,
              active: true,
            },
      );
      setFeedback({ error: false, text: `${scheduleKindLabel(kind)}: template salvo.` });
    } catch {
      setFeedback({ error: true, text: "Erro de rede." });
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-bold tracking-tight">Avisos de metas</h2>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Quando o cliente cria uma meta, o sistema agenda um WhatsApp para a véspera de cada data
        de aporte. Se o aporte daquela data já foi feito, o aviso é cancelado. Se a meta muda de
        plano, os avisos pendentes são refeitos; se a meta é concluída ou cancelada, eles param.
      </p>
      <p className="mt-2 text-xs text-[var(--ink-muted)]">
        Variáveis: {"{{meta}}"}, {"{{reserva}}"}, {"{{data}}"}, {"{{nome}}"}, {"{{valor}}"}
      </p>
      {feedback ? (
        <p
          className={
            feedback.error
              ? "mt-3 text-sm font-medium text-[var(--danger)]"
              : "mt-3 text-sm font-medium text-[var(--accent)]"
          }
        >
          {feedback.text}
        </p>
      ) : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {GOAL_SCHEDULE_KINDS.map((kind) => (
          <div key={kind} className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{scheduleKindLabel(kind)}</h3>
              <p className="text-xs text-[var(--ink-muted)]">{noticeHint(kind)}</p>
            </div>
            <Textarea
              label="Texto do aviso"
              value={bodies[kind]}
              onChange={(e) => setBodies((prev) => ({ ...prev, [kind]: e.target.value }))}
              className="min-h-28 font-mono text-sm"
            />
            <p className="rounded-lg bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--ink-muted)]">
              {renderGoalNotice(bodies[kind], {
                meta: "Meu iPhone",
                reserva: "iPhone 16",
                dueDate: sampleDue,
                nome: "Maria",
                valor: "R$ 250,00",
              })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving !== null || !bodies[kind].trim()}
              onClick={() => void save(kind)}
            >
              {saving === kind ? "Salvando…" : "Salvar aviso"}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
