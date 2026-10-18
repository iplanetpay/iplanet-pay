/**
 * Dates run from startDate through endDate.
 * The first aporte is the start date; weekly and monthly repeat from that day.
 * endDate must be strictly later. The last installment absorbs leftover cents.
 */

export type ContributionFrequency = "daily" | "weekly" | "monthly";

export type ContributionSlotStatus = "on_time" | "late" | "missed" | "upcoming";

export const CONTRIBUTION_FREQUENCIES: readonly ContributionFrequency[] = [
  "daily",
  "weekly",
  "monthly",
];

export interface ContributionPlan {
  remainingCents: number;
  installmentCount: number;
  amountPerInstallmentCents: number;
  lastInstallmentCents: number;
  dates: string[];
}

export interface PlanContribution {
  paidOn: string;
  amountCents: number;
}

interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isContributionFrequency(
  value: unknown,
): value is ContributionFrequency {
  return value === "daily" || value === "weekly" || value === "monthly";
}

export function calendarToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isoDateInTimeZone(
  instantIso: string,
  timeZone = "America/Sao_Paulo",
): string | null {
  const instant = new Date(instantIso);
  if (Number.isNaN(instant.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return parseIsoDate(formatted) ? formatted : null;
}

export function formatPlanDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day),
  ).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function addCalendarDays(iso: string, days: number): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) throw new Error("Data inválida.");
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return formatIso(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function frequencyChoiceLabel(frequency: ContributionFrequency): string {
  switch (frequency) {
    case "daily":
      return "Aportes diários";
    case "weekly":
      return "Aportes semanais";
    case "monthly":
      return "Aportes mensais";
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Frequência inválida: ${String(_exhaustive)}`);
    }
  }
}

export function frequencyShortLabel(frequency: ContributionFrequency): string {
  switch (frequency) {
    case "daily":
      return "Diário";
    case "weekly":
      return "Semanal";
    case "monthly":
      return "Mensal";
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Frequência inválida: ${String(_exhaustive)}`);
    }
  }
}

export function frequencyPeriodLabel(frequency: ContributionFrequency): string {
  switch (frequency) {
    case "daily":
      return "por dia";
    case "weekly":
      return "por semana";
    case "monthly":
      return "por mês";
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Frequência inválida: ${String(_exhaustive)}`);
    }
  }
}

export function frequencyRhythmLabel(
  frequency: ContributionFrequency,
  count: number,
): string {
  if (count === 1) {
    switch (frequency) {
      case "daily":
        return "diário";
      case "weekly":
        return "semanal";
      case "monthly":
        return "mensal";
      default: {
        const _exhaustive: never = frequency;
        throw new Error(`Frequência inválida: ${String(_exhaustive)}`);
      }
    }
  }
  switch (frequency) {
    case "daily":
      return "diários";
    case "weekly":
      return "semanais";
    case "monthly":
      return "mensais";
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Frequência inválida: ${String(_exhaustive)}`);
    }
  }
}

export function contributionStatusLabel(status: ContributionSlotStatus): string {
  switch (status) {
    case "on_time":
      return "Aportado no prazo";
    case "late":
      return "Aportado atrasado";
    case "missed":
      return "Não aportado";
    case "upcoming":
      return "A aportar";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Status inválido: ${String(_exhaustive)}`);
    }
  }
}

export function installmentCentsAt(plan: ContributionPlan, index: number): number {
  if (index < 0 || index >= plan.installmentCount) {
    throw new Error("Aporte fora do plano.");
  }
  if (index === plan.installmentCount - 1) return plan.lastInstallmentCents;
  return plan.amountPerInstallmentCents;
}

export function buildContributionPlan(input: {
  targetCents: number;
  contributedCents: number;
  startDate: string;
  endDate: string;
  frequency: ContributionFrequency;
}): ContributionPlan {
  if (!Number.isFinite(input.targetCents) || input.targetCents <= 0) {
    throw new Error("Valor da meta inválido.");
  }
  if (!Number.isFinite(input.contributedCents)) {
    throw new Error("Valor já aportado inválido.");
  }
  if (!isContributionFrequency(input.frequency)) {
    throw new Error("Frequência inválida.");
  }

  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();
  if (!parseIsoDate(startDate) || !parseIsoDate(endDate)) {
    throw new Error("Data inválida.");
  }
  if (endDate <= startDate) {
    throw new Error("A data para concluir precisa ser depois do início.");
  }

  const targetCents = Math.round(input.targetCents);
  const contributedCents = Math.max(0, Math.round(input.contributedCents));
  const remainingCents = Math.max(0, targetCents - contributedCents);
  const dates = scheduleDates(startDate, endDate, input.frequency);
  const installmentCount = dates.length;
  const amountPerInstallmentCents = Math.floor(remainingCents / installmentCount);
  const lastInstallmentCents =
    remainingCents - amountPerInstallmentCents * (installmentCount - 1);

  return {
    remainingCents,
    installmentCount,
    amountPerInstallmentCents,
    lastInstallmentCents,
    dates,
  };
}

/**
 * Aporte no prazo cai na janela (data anterior, data].
 * Se a data já passou e o aporte chegou antes da próxima, fica atrasado.
 * Data de hoje ou futura sem aporte continua a aportar.
 */
export function assignContributionStatuses(input: {
  dates: string[];
  today: string;
  contributions: PlanContribution[];
}): ContributionSlotStatus[] {
  const dates = input.dates;
  const pool = input.contributions
    .filter(
      (contribution) =>
        contribution.amountCents > 0 &&
        contribution.paidOn <= input.today &&
        parseIsoDate(contribution.paidOn) !== null,
    )
    .map((contribution) => ({ paidOn: contribution.paidOn, used: false }))
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn));

  const statuses: ContributionSlotStatus[] = [];

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    const previous = index > 0 ? dates[index - 1] : "";
    const next = index + 1 < dates.length ? dates[index + 1] : null;
    const onTime = pool.find(
      (contribution) =>
        !contribution.used &&
        contribution.paidOn > previous &&
        contribution.paidOn <= date,
    );
    if (onTime) {
      onTime.used = true;
      statuses.push("on_time");
      continue;
    }
    if (date >= input.today) {
      statuses.push("upcoming");
      continue;
    }
    const late = pool.find((contribution) => {
      if (contribution.used) return false;
      if (contribution.paidOn <= date || contribution.paidOn > input.today) return false;
      if (next && contribution.paidOn >= next) return false;
      return true;
    });
    if (late) {
      late.used = true;
      statuses.push("late");
      continue;
    }
    statuses.push("missed");
  }

  return statuses;
}

export interface AppliedInstallment {
  dueDate: string;
  baseCents: number;
  dueCents: number;
  paidCents: number;
  paid: boolean;
  settledOn: string | null;
  /** This date was reduced, or paid, by money that arrived ahead of its own amount. */
  antecipado: boolean;
}

/**
 * Applies contributions in date order to the next unpaid installment.
 * Surplus stays on the following dates: the date does not move, the amount due drops.
 * A surplus that covers an installment marks it paid and continues into the one after it.
 */
export function applyEarlyPayments(input: {
  installments: readonly { dueDate: string; amountCents: number }[];
  contributions: readonly PlanContribution[];
}): AppliedInstallment[] {
  const rows: AppliedInstallment[] = input.installments.map((item) => {
    const baseCents = Math.max(0, Math.round(item.amountCents));
    return {
      dueDate: item.dueDate,
      baseCents,
      dueCents: baseCents,
      paidCents: 0,
      paid: baseCents === 0,
      settledOn: null,
      antecipado: false,
    };
  });

  const payments = input.contributions
    .filter(
      (contribution) =>
        contribution.amountCents > 0 && parseIsoDate(contribution.paidOn) !== null,
    )
    .map((contribution) => ({
      paidOn: contribution.paidOn,
      amountCents: Math.round(contribution.amountCents),
    }))
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn));

  for (const payment of payments) {
    let money = payment.amountCents;
    let carried = false;
    for (const row of rows) {
      if (money <= 0) break;
      if (row.dueCents <= 0) continue;
      const needed = row.dueCents;
      const exceeds = money > needed;
      if (carried || (payment.paidOn < row.dueDate && exceeds)) {
        row.antecipado = true;
      }
      const take = Math.min(money, needed);
      row.dueCents -= take;
      row.paidCents += take;
      money -= take;
      if (row.dueCents === 0) {
        row.paid = true;
        row.settledOn = payment.paidOn;
      }
      carried = money > 0;
    }
  }

  for (const row of rows) {
    if (row.dueCents < 0) row.dueCents = 0;
    if (row.dueCents === 0) row.paid = true;
    if (!row.paid && row.dueCents < row.baseCents) row.antecipado = true;
  }

  return rows;
}

/** Remaining cents of the next installment that is not fully paid. */
export function nextOpenAporteCents(rows: readonly AppliedInstallment[]): number | null {
  const open = rows.find((row) => !row.paid);
  return open ? open.dueCents : null;
}

function scheduleDates(
  startDate: string,
  endDate: string,
  frequency: ContributionFrequency,
): string[] {
  const dates: string[] = [];

  for (let step = 0; step < 4000; step += 1) {
    const cursor = stepFromStart(startDate, frequency, step);
    if (cursor > endDate) break;
    dates.push(cursor);
  }

  if (dates.length === 0) {
    throw new Error("Nenhum aporte cabe nesse prazo.");
  }
  if (dates.length >= 4000 && stepFromStart(startDate, frequency, dates.length) <= endDate) {
    throw new Error("Prazo longo demais para esta frequência.");
  }

  return dates;
}

function stepFromStart(
  startDate: string,
  frequency: ContributionFrequency,
  step: number,
): string {
  switch (frequency) {
    case "daily":
      return addCalendarDays(startDate, step);
    case "weekly":
      return addCalendarDays(startDate, step * 7);
    case "monthly":
      return addCalendarMonths(startDate, step);
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Frequência inválida: ${String(_exhaustive)}`);
    }
  }
}

function addCalendarMonths(iso: string, delta: number): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) throw new Error("Data inválida.");
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1 + delta, 1));
  const year = shifted.getUTCFullYear();
  const monthIndex = shifted.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(parsed.day, lastDay);
  return formatIso(year, monthIndex + 1, day);
}

function parseIsoDate(value: string): CalendarParts | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function formatIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
