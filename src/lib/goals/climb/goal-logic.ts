import type { Deposit, DepositStatus, GoalState, GoalStatus } from "./types.ts";

/** Reais. Inteiros ficam sem centavos; valores quebrados mostram os dois dígitos. */
export function brl(value: number): string {
  const cents = Math.round(value * 100);
  const fraction = Math.abs(cents) % 100 === 0 ? 0 : 2;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
}

export function percentOf(goal: GoalState): number {
  const p = goal.percent ?? (goal.savedAmount / goal.targetAmount) * 100;
  return Math.max(0, Math.min(100, p));
}

/**
 * Deriva o status a partir dos aportes. O backend pode usar isto ou mandar `status` pronto.
 *  - done: 100% guardado
 *  - late: existe aporte vencido e não pago
 *  - near_late: o próximo aporte vence hoje ou amanhã
 *  - on_track: demais casos
 */
export function deriveStatus(
  deposits: Deposit[],
  percent: number,
  today: string | Date = saoPauloToday(),
): GoalStatus {
  if (percent >= 100) return "done";
  const todayIso = typeof today === "string" ? today : saoPauloToday(today);
  if (
    deposits.some(
      (deposit) =>
        deposit.status === "missed" ||
        (deposit.status === "pending" && deposit.dueDate < todayIso),
    )
  ) {
    return "late";
  }
  const next = deposits.find((deposit) => deposit.status === "pending");
  if (next && next.dueDate <= addIsoDays(todayIso, 1)) return "near_late";
  return "on_track";
}

/** Rótulo e tom do indicador de status (discreto). */
export function statusInfo(status: GoalStatus): { label: string; tone: 'good' | 'warn' | 'bad' | 'blue'; message: string } {
  switch (status) {
    case 'on_track':
      return { label: 'Em dia', tone: 'good', message: 'Você está em dia. Continue assim.' };
    case 'near_late':
      return { label: 'Quase atrasada', tone: 'warn', message: 'O próximo aporte vence logo.' };
    case 'late':
      return { label: 'Atrasada', tone: 'bad', message: 'Faça o aporte para voltar ao ritmo.' };
    case "done":
      return { label: "Conquistada", tone: "blue", message: "Você conquistou a meta. Parabéns!" };
    default: {
      const exhaustive: never = status;
      throw new Error(`Status inválido: ${String(exhaustive)}`);
    }
  }
}

export function nextDeposit(goal: GoalState): Deposit | undefined {
  return (
    goal.deposits.find((d) => d.status === 'missed') ?? goal.deposits.find((d) => d.status === 'pending')
  );
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function relativeDue(iso: string, today = saoPauloToday()): string {
  const todayIso = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : saoPauloToday();
  const days = isoDayDelta(todayIso, iso);
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days > 1) return `em ${days} dias`;
  if (days === -1) return "atrasado há 1 dia";
  return `atrasado há ${-days} dias`;
}

/** Dia civil em São Paulo, no mesmo fuso do calendário de aportes. */
export function saoPauloToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addIsoDays(iso: string, days: number): string {
  const next = new Date(utcDay(iso) + days * 86400000);
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isoDayDelta(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / 86400000);
}

/** Sequência atual de aportes no prazo. Um atraso zera; pendente encerra a conta. */
export function climbStreak(deposits: Array<{ status: DepositStatus }>): number {
  let streak = 0;
  for (const deposit of deposits) {
    switch (deposit.status) {
      case "paid_on_time":
        streak += 1;
        break;
      case "paid_late":
      case "missed":
        streak = 0;
        break;
      case "pending":
        return streak;
      default: {
        const exhaustive: never = deposit.status;
        throw new Error(`Status inválido: ${String(exhaustive)}`);
      }
    }
  }
  return streak;
}

/** Dias desde o aporte vencido mais antigo. */
export function climbDaysLate(
  today: string,
  deposits: Array<{ status: DepositStatus; dueDate: string }>,
): number {
  const overdue = deposits
    .filter(
      (deposit) =>
        deposit.status === "missed" ||
        (deposit.status === "pending" && deposit.dueDate < today),
    )
    .map((deposit) => deposit.dueDate)
    .sort();
  const earliest = overdue[0];
  if (!earliest) return 0;
  return Math.max(1, isoDayDelta(earliest, today));
}

function utcDay(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
