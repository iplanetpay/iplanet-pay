"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import {
  defaultMonthIndex,
  installmentStatusLabel,
  planMonthKeys,
  stepMonthIndex,
  type CalendarMark,
  type InstallmentStatus,
  type MarkedDay,
} from "@/lib/goals/calendar-marks";
import { goalHealthLabel, type GoalHealth } from "@/lib/goals/journey";
import {
  formatPlanDate,
  frequencyPeriodLabel,
  frequencyRhythmLabel,
  type ContributionFrequency,
} from "@/lib/reservations/contribution-plan";
import { formatCentsBRL } from "@/lib/utils";

const spring = { type: "spring" as const, stiffness: 380, damping: 32 };
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export type ContributionDue = {
  date: string;
  amountCents: number;
  status: InstallmentStatus;
  note?: string;
};

export function ContributionCalendar({
  goalName,
  frequency,
  installmentCount,
  heroCents,
  heroLabel,
  lastCents,
  deadline,
  dues,
  marks,
  health,
  paged = false,
  today = "",
}: {
  goalName: string;
  frequency: ContributionFrequency;
  installmentCount: number;
  heroCents: number;
  heroLabel?: string;
  lastCents: number;
  deadline: string;
  dues: ContributionDue[];
  marks: MarkedDay[];
  health: GoalHealth;
  paged?: boolean;
  today?: string;
}) {
  const byDate = new Map(marks.map((day) => [day.date, day.marks]));
  const sourceDates = paged ? dues.map((due) => due.date) : marks.map((day) => day.date);
  const months = monthGroups(sourceDates);
  const upcomingDate = dues.find((due) => due.status === "upcoming")?.date ?? null;
  const [monthIndex, setMonthIndex] = useState(() =>
    defaultMonthIndex({
      months: planMonthKeys(sourceDates),
      today,
      upcomingDate,
    }),
  );
  const [showAll, setShowAll] = useState(false);
  const visible = paged && !showAll ? months.slice(monthIndex, monthIndex + 1) : months;
  const canPage = paged && months.length > 1;

  return (
    <Card className="space-y-6" data-testid="calendario-aportes">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="space-y-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Meta
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)]">
              {goalName}
            </h2>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              {installmentCount} {installmentCount === 1 ? "aporte" : "aportes"}{" "}
              {frequencyRhythmLabel(frequency, installmentCount)} até{" "}
              {formatPlanDate(deadline)}
            </p>
          </div>
          <Pill tone={healthTone(health)}>{goalHealthLabel(health)}</Pill>
        </div>

        <div className="rounded-[20px] bg-[var(--bg-subtle)] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            {heroLabel ?? `Valor por aporte · ${frequencyPeriodLabel(frequency)}`}
          </p>
          <p
            className="mt-1 text-4xl font-bold tracking-tight text-[var(--ink)]"
            data-testid="proximo-aporte"
          >
            {formatCentsBRL(heroCents)}
          </p>
          <p className="mt-2 font-semibold text-[var(--accent)]">{calendarPayoff(dues, health)}</p>
          {lastCents !== heroCents ? (
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              O último aporte fica em {formatCentsBRL(lastCents)}.
            </p>
          ) : null}
        </div>

        <ul className="flex flex-wrap gap-3 text-xs font-semibold text-[var(--ink-muted)]">
          <li className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full ring-2 ring-[#0071e3]" />
            Data do aporte
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-[var(--success)]" />
            No prazo
          </li>
          <li className="flex items-center gap-2">
            <X className="h-4 w-4 text-[var(--danger)]" />
            Pago atrasado
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#e0a100]" />
            Dia do pagamento
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />
            Dia em atraso
          </li>
        </ul>

        {canPage ? (
          <div
            className={`flex flex-wrap items-center gap-2 ${showAll ? "justify-end" : "justify-between"}`}
          >
            {showAll ? null : (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="h-10 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
                  disabled={monthIndex <= 0}
                  onClick={() => setMonthIndex((index) => stepMonthIndex(index, -1, months.length))}
                >
                  Mês anterior
                </button>
                <button
                  type="button"
                  className="h-10 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
                  disabled={monthIndex >= months.length - 1}
                  onClick={() => setMonthIndex((index) => stepMonthIndex(index, 1, months.length))}
                >
                  Próximo mês
                </button>
              </div>
            )}
            <button
              type="button"
              className="h-10 rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              onClick={() => setShowAll((open) => !open)}
            >
              {showAll ? "Mostrar um mês" : "Mostrar todos"}
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-5" data-testid="calendario-meses">
            {visible.map((month) => (
              <MonthGrid key={month.key} month={month} byDate={byDate} />
            ))}
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {dues.map((day) => (
              <li
                key={day.date}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white px-3 py-2"
              >
                <span className="text-sm font-semibold text-[var(--ink)]">
                  {formatPlanDate(day.date)}
                </span>
                <span className="text-right text-sm">
                  <span className="block text-[var(--ink-muted)]">
                    {formatCentsBRL(day.amountCents)}
                  </span>
                  <span className={`font-semibold ${statusTextClass(day.status)}`}>
                    {day.note ? `${day.note} · ` : ""}
                    {installmentStatusLabel(day.status)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </Card>
  );
}

function MonthGrid({
  month,
  byDate,
}: {
  month: { key: string; label: string; cells: Array<string | null> };
  byDate: Map<string, CalendarMark[]>;
}) {
  return (
    <div data-calendar-month={month.key}>
      <p className="mb-3 text-sm font-semibold capitalize text-[var(--ink)]">
        {month.label}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {month.cells.map((iso, index) => {
          if (!iso) return <span key={`${month.key}-empty-${index}`} className="h-10" />;
          const marks = byDate.get(iso) ?? [];
          const dayNumber = Number(iso.slice(8));
          if (marks.length === 0) {
            return (
              <span
                key={iso}
                className="flex h-10 items-center justify-center text-sm text-[var(--ink-muted)]"
              >
                {dayNumber}
              </span>
            );
          }
          return (
            <span
              key={iso}
              title={markTitle(iso, marks)}
              data-calendar-date={iso}
              data-calendar-mark={marks.join(" ")}
              className={`relative flex h-10 items-center justify-center rounded-full text-sm font-semibold ${cellClass(marks)}`}
            >
              <CellGlyph marks={marks} dayNumber={dayNumber} />
              {marks.includes("missed") ? (
                <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
              ) : null}
              {marks.includes("late_paid") ? (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#e0a100]" />
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CellGlyph({ marks, dayNumber }: { marks: CalendarMark[]; dayNumber: number }) {
  if (marks.includes("on_time")) {
    return <Check className="h-4 w-4 text-[var(--success)]" aria-label="No prazo" />;
  }
  if (marks.includes("late_due")) {
    return <X className="h-4 w-4 text-[var(--danger)]" aria-label="Pago atrasado" />;
  }
  return <span>{dayNumber}</span>;
}

function monthGroups(dates: string[]): Array<{
  key: string;
  label: string;
  cells: Array<string | null>;
}> {
  const keys: string[] = [];
  for (const date of [...dates].sort()) {
    const key = date.slice(0, 7);
    if (!keys.includes(key)) keys.push(key);
  }
  return keys.map((key) => {
    const [yearText, monthText] = key.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    return { key, label, cells: monthCells(year, month) };
  });
}

function monthCells(year: number, month: number): Array<string | null> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= count; day += 1) {
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(iso);
  }
  return cells;
}

function calendarPayoff(dues: ContributionDue[], health: GoalHealth): string {
  switch (health) {
    case "complete":
      return "Meta cumprida.";
    case "late":
      return "Tem aporte em atraso. Os dias ficam marcados.";
    case "near_late":
      return "O próximo aporte está perto.";
    case "on_track":
      if (dues.length > 0 && dues.every((day) => day.status === "on_time")) {
        return "Meta cumprida no prazo.";
      }
      return "Você chega lá.";
    default: {
      const _exhaustive: never = health;
      throw new Error(String(_exhaustive));
    }
  }
}

function healthTone(health: GoalHealth): "accent" | "success" | "danger" | "neutral" {
  switch (health) {
    case "on_track":
      return "accent";
    case "near_late":
      return "neutral";
    case "late":
      return "danger";
    case "complete":
      return "success";
    default: {
      const _exhaustive: never = health;
      throw new Error(String(_exhaustive));
    }
  }
}

function cellClass(marks: CalendarMark[]): string {
  if (marks.includes("due") || marks.includes("upcoming")) {
    return "bg-white text-[var(--ink)] ring-2 ring-[#0071e3]";
  }
  if (marks.includes("missed")) return "bg-red-50 text-[var(--danger)]";
  if (marks.includes("late_paid")) return "bg-[#fff6e0] text-[#8a5a00]";
  return "bg-white text-[var(--ink)]";
}

function statusTextClass(status: InstallmentStatus): string {
  switch (status) {
    case "on_time":
      return "text-[var(--success)]";
    case "late_payment":
      return "text-[#8a5a00]";
    case "missed":
      return "text-[var(--danger)]";
    case "upcoming":
      return "text-[var(--accent)]";
    default: {
      const _exhaustive: never = status;
      throw new Error(String(_exhaustive));
    }
  }
}

function markTitle(iso: string, marks: CalendarMark[]): string {
  const labels = marks.map((mark) => {
    switch (mark) {
      case "due":
        return "data do aporte";
      case "upcoming":
        return "a aportar";
      case "on_time":
        return "no prazo";
      case "late_due":
        return "pago atrasado";
      case "late_paid":
        return "dia do pagamento";
      case "missed":
        return "dia em atraso";
      default: {
        const _exhaustive: never = mark;
        return String(_exhaustive);
      }
    }
  });
  return `${formatPlanDate(iso)} — ${labels.join(", ")}`;
}
