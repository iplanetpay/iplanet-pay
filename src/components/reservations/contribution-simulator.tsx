"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useSpring, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CONTRIBUTION_FREQUENCIES,
  addCalendarDays,
  buildContributionPlan,
  formatPlanDate,
  frequencyPeriodLabel,
  frequencyRhythmLabel,
  frequencyShortLabel,
  type ContributionFrequency,
  type ContributionPlan,
} from "@/lib/reservations/contribution-plan";
import { formatCentsBRL } from "@/lib/utils";

const spring = { type: "spring" as const, stiffness: 380, damping: 32 };

export type SimulatorProduct = {
  id: string;
  name: string;
  listPriceCents: number;
  /** Variante do catálogo (cor/armazenamento); `key` diferencia as opções do mesmo produto. */
  variantId?: string | null;
  key?: string;
};

const optionKey = (product: SimulatorProduct) => product.key ?? product.id;

export type SimulatorReservation = {
  id: string;
  productId: string;
  listPriceCents: number;
  contributedCents: number;
};

export function ContributionSimulator({
  products,
  reservation = null,
  today,
  productLocked = false,
  embedded = false,
  showIntro = true,
  initialName = "",
  initialStartDate = "",
  initialDate = "",
  initialFrequency = "monthly",
  initialProductKey,
  onCreated,
}: {
  products: SimulatorProduct[];
  reservation?: SimulatorReservation | null;
  today: string;
  productLocked?: boolean;
  embedded?: boolean;
  showIntro?: boolean;
  initialName?: string;
  initialStartDate?: string;
  initialDate?: string;
  initialFrequency?: ContributionFrequency;
  initialProductKey?: string;
  onCreated?: (result: {
    reservationId: string;
    goalId: string;
    name: string;
    frequency: ContributionFrequency;
    targetDate: string;
    plan: ContributionPlan;
  }) => void;
}) {
  const router = useRouter();
  const options = useMemo(() => {
    const list = [...products];
    if (
      reservation &&
      !list.some((product) => product.id === reservation.productId)
    ) {
      list.unshift({
        id: reservation.productId,
        name: "Produto da reserva",
        listPriceCents: reservation.listPriceCents,
      });
    }
    return list;
  }, [products, reservation]);

  const [name, setName] = useState(initialName);
  const [productId, setProductId] = useState(
    reservation?.productId ??
      (initialProductKey && options.some((p) => optionKey(p) === initialProductKey)
        ? initialProductKey
        : options[0] ? optionKey(options[0]) : ""),
  );
  const [startDate, setStartDate] = useState(initialStartDate || today);
  const [targetDate, setTargetDate] = useState(initialDate);
  const [frequency, setFrequency] = useState<ContributionFrequency>(initialFrequency);
  const [simulated, setSimulated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minEndDate = addCalendarDays(startDate || today, 1);
  const selected = options.find((product) => optionKey(product) === productId) ?? null;
  const targetCents =
    reservation && productLocked
      ? reservation.listPriceCents
      : (selected?.listPriceCents ?? 0);
  const contributedCents =
    reservation && productLocked ? reservation.contributedCents : 0;

  const plan = useMemo(() => {
    if (!simulated || targetCents <= 0 || !startDate || !targetDate) return null;
    try {
      return buildContributionPlan({
        targetCents,
        contributedCents,
        startDate,
        endDate: targetDate,
        frequency,
      });
    } catch (err) {
      return err instanceof Error ? err.message : "Não foi possível simular.";
    }
  }, [simulated, targetCents, contributedCents, startDate, targetDate, frequency]);

  const planError = typeof plan === "string" ? plan : null;
  const planValue = typeof plan === "string" || plan == null ? null : plan;
  const visiblePlan =
    planValue && planValue.remainingCents > 0 ? planValue : null;

  function simulate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSimulated(true);
  }

  async function createMeta() {
    if (!visiblePlan) return;
    if (!name.trim()) {
      setError("Dê um nome para a meta.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          product_id: productLocked ? reservation?.productId : selected?.id,
          variant_id: productLocked ? null : (selected?.variantId ?? null),
          target_date: targetDate,
          start_date: startDate,
          frequency,
          reservation_id: reservation && productLocked ? reservation.id : null,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        needsAuth?: boolean;
        reservation_id?: string;
        goal_id?: string;
      };
      if (data.needsAuth) {
        const next = reservation
          ? `/app/reserva/${reservation.id}`
          : "/app";
        router.push(`/entrar?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!res.ok || !data.ok || !data.reservation_id || !data.goal_id) {
        setError(data.error ?? "Não foi possível criar a meta.");
        return;
      }
      if (onCreated) {
        onCreated({
          reservationId: data.reservation_id,
          goalId: data.goal_id,
          name: name.trim(),
          frequency,
          targetDate,
          plan: visiblePlan,
        });
        return;
      }
      router.push(`/app/reserva/${data.reservation_id}`);
      router.refresh();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const body = (
    <div className="space-y-6">
      {showIntro ? (
        <div>
          <h2
            id="simulador-de-aportes"
            className="text-2xl font-bold tracking-tight text-[var(--ink)]"
          >
            Simulador de aportes
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Escolha o ritmo. O valor de cada aporte aparece para fechar o produto
            na data combinada.
          </p>
        </div>
      ) : null}

      <form className="grid gap-4 md:grid-cols-2" onSubmit={simulate}>
        <Input
          label="Nome da meta"
          name="goal_name"
          value={name}
          placeholder="Ex.: iPhone até o fim do ano"
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
        <Select
          label={productLocked ? "Produto" : "Selecionar um produto do catálogo"}
          name="product_id"
          value={productId}
          disabled={productLocked || options.length === 0}
          onChange={(event) => {
            if (productLocked) return;
            setProductId(event.target.value);
          }}
          hint={productLocked ? "Produto desta reserva." : undefined}
        >
          {options.length === 0 ? (
            <option value="">Nenhum produto no catálogo</option>
          ) : (
            options.map((product) => (
              <option key={optionKey(product)} value={optionKey(product)}>
                {product.name}
              </option>
            ))
          )}
        </Select>
        <Input
          label="Data de início"
          name="start_date"
          type="date"
          min={today}
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          hint="Os aportes começam neste dia."
          required
        />
        <Input
          label="Data para concluir"
          name="target_date"
          type="date"
          min={minEndDate}
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
          hint="Precisa ser depois da data de início."
          required
        />
        <fieldset className="md:col-span-2">
          <legend className="mb-2 text-sm font-medium text-[var(--ink)]">
            Frequência
          </legend>
          <div
            role="radiogroup"
            aria-label="Frequência"
            className="grid gap-2 sm:grid-cols-3"
          >
            {CONTRIBUTION_FREQUENCIES.map((value) => {
              const selectedFrequency = frequency === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selectedFrequency}
                  onClick={() => setFrequency(value)}
                  className={
                    selectedFrequency
                      ? "h-12 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] text-sm font-semibold text-[var(--ink)]"
                      : "h-12 rounded-2xl border border-[var(--line)] bg-white text-sm font-semibold text-[var(--ink-muted)]"
                  }
                >
                  {frequencyShortLabel(value)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="md:col-span-2">
          <Button type="submit" variant="primary" disabled={saving || !productId}>
            Simular
          </Button>
        </div>
      </form>

      {error || planError || (planValue && planValue.remainingCents <= 0) ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error ??
            planError ??
            "Não há valor restante para aportar."}
        </p>
      ) : null}

      <div aria-live="polite">
        <AnimatePresence mode="wait">
          {visiblePlan ? (
            <SimulatorPayoff
              key={`${frequency}-${visiblePlan.installmentCount}-${visiblePlan.amountPerInstallmentCents}-${visiblePlan.lastInstallmentCents}-${startDate}-${targetDate}`}
              plan={visiblePlan}
              frequency={frequency}
              contributedCents={contributedCents}
              targetCents={targetCents}
              saving={saving}
              onCreate={() => void createMeta()}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );

  if (embedded) return body;
  return <Card>{body}</Card>;
}

function SimulatorPayoff({
  plan,
  frequency,
  contributedCents,
  targetCents,
  saving,
  onCreate,
}: {
  plan: ContributionPlan;
  frequency: ContributionFrequency;
  contributedCents: number;
  targetCents: number;
  saving: boolean;
  onCreate: () => void;
}) {
  const heroCents =
    plan.amountPerInstallmentCents > 0
      ? plan.amountPerInstallmentCents
      : plan.lastInstallmentCents;
  const paidPercent =
    targetCents > 0
      ? Math.max(0, Math.min(100, Math.round((contributedCents / targetCents) * 100)))
      : 0;
  const percent = useSpring(paidPercent, { stiffness: 60, damping: 18 });

  useEffect(() => {
    percent.set(100);
  }, [percent]);

  const percentLabel = useTransform(percent, (value) => `${Math.round(value)}%`);
  const size = 112;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = useTransform(percent, (value) => {
    const clamped = Math.max(0, Math.min(100, value));
    return circumference - (clamped / 100) * circumference;
  });
  const preview = plan.dates.slice(0, 8);
  const hidden = plan.dates.length - preview.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={spring}
      data-testid="simulador-resultado"
      className="rounded-[20px] border border-[var(--line)] bg-[var(--bg-subtle)] p-5"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-28 w-28 shrink-0">
          <svg width={size} height={size} className="-rotate-90" aria-hidden>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="white"
              strokeWidth={stroke}
            />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              style={{ strokeDashoffset: dash }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span className="text-lg font-bold tracking-tight text-[var(--ink)]">
              {percentLabel}
            </motion.span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
              projeção
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Valor por aporte · {frequencyPeriodLabel(frequency)}
          </p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="mt-1 text-4xl font-bold tracking-tight text-[var(--ink)]"
          >
            {formatCentsBRL(heroCents)}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.08 }}
            className="mt-2 text-sm text-[var(--ink-muted)]"
          >
            {plan.installmentCount}{" "}
            {plan.installmentCount === 1 ? "aporte" : "aportes"}{" "}
            {frequencyRhythmLabel(frequency, plan.installmentCount)} até{" "}
            {formatPlanDate(plan.dates[plan.dates.length - 1] ?? "")}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.14 }}
            className="mt-2 text-base font-semibold text-[var(--accent)]"
          >
            Você chega lá.
          </motion.p>
          {contributedCents > 0 ? (
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              Já aportado {formatCentsBRL(contributedCents)}. O plano cobre os{" "}
              {formatCentsBRL(plan.remainingCents)} restantes.
            </p>
          ) : null}
          {plan.lastInstallmentCents !== plan.amountPerInstallmentCents ? (
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              O último aporte fica em {formatCentsBRL(plan.lastInstallmentCents)}{" "}
              para fechar os centavos.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          Sequência
        </p>
        <ol className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {preview.map((date, index) => {
            const chip = dateChip(date);
            return (
              <motion.li
                key={date}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.12 + index * 0.04 }}
                className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-white"
              >
                <span className="text-sm font-bold text-[var(--ink)]">{chip.day}</span>
                <span className="text-[10px] uppercase text-[var(--ink-muted)]">
                  {chip.month}
                </span>
              </motion.li>
            );
          })}
          {hidden > 0 ? (
            <li className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-xs font-semibold text-[var(--ink-muted)]">
              +{hidden}
            </li>
          ) : null}
        </ol>
      </div>

      <div className="mt-6">
        <Button
          type="button"
          variant="accent"
          disabled={saving}
          onClick={onCreate}
        >
          {saving ? "Criando meta..." : "Criar meta"}
        </Button>
      </div>
    </motion.div>
  );
}

function dateChip(iso: string): { day: string; month: string } {
  const [year, month, day] = iso.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
    "pt-BR",
    { month: "short", timeZone: "UTC" },
  );
  return {
    day: String(day).padStart(2, "0"),
    month: monthLabel.replace(".", ""),
  };
}
