/**
 * Dados de exemplo (mock) — troque por chamadas ao backend de metas/aportes.
 * As datas são relativas a "hoje" para o preview sempre fazer sentido.
 */
import type { Deposit, DepositStatus, GoalState, GoalStatus } from "./types.ts";

const DAY = 86400000;
const iso = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const TARGET = 6499;
const COUNT = 10; // 10 aportes semanais

/** Monta a agenda de aportes. `statuses[i]` define cada aporte; o primeiro pendente vence em `nextInDays`. */
function schedule(statuses: DepositStatus[], nextInDays: number): Deposit[] {
  const firstPending = statuses.findIndex((s) => s === 'pending' || s === 'missed');
  const anchor = firstPending === -1 ? statuses.length : firstPending;
  return statuses.map((status, i) => {
    const dueOffset = nextInDays + (i - anchor) * 7;
    const due = iso(dueOffset);
    return {
      id: `dep-${i + 1}`,
      dueDate: due,
      amount: Math.round((TARGET / COUNT) * 100) / 100,
      status,
      paidAt: status === 'paid_on_time' ? due : status === 'paid_late' ? iso(dueOffset + 3) : undefined,
    };
  });
}

const rep = (n: number, s: DepositStatus): DepositStatus[] => Array(n).fill(s);

function build(
  id: string,
  statuses: DepositStatus[],
  status: GoalStatus,
  nextInDays: number,
  extra: Partial<GoalState> = {},
): GoalState {
  const deposits = schedule(statuses, nextInDays);
  const paid = deposits.filter((d) => d.status.startsWith('paid')).length;
  const saved = Math.round((TARGET * paid) / COUNT);
  return {
    id,
    name: 'Meu iPhone novo',
    product: { name: 'iPhone 16 Pro 128 GB', kind: 'phone' },
    status,
    targetAmount: TARGET,
    savedAmount: saved,
    deposits,
    ...extra,
  };
}

export interface GoalPreset {
  key: string;
  label: string;
  goal: GoalState;
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    key: 'on_track',
    label: 'Em dia',
    goal: build('g-ontrack', [...rep(5, 'paid_on_time'), ...rep(5, 'pending')], 'on_track', 4, { streak: 5 }),
  },
  {
    key: 'near_late',
    label: 'Quase atrasada',
    goal: build('g-near', [...rep(4, 'paid_on_time'), ...rep(6, 'pending')], 'near_late', 1, { streak: 4 }),
  },
  {
    key: 'late',
    label: 'Atrasada',
    goal: build(
      'g-late',
      ['paid_on_time', 'paid_on_time', 'paid_on_time', 'paid_late', 'missed', 'missed', ...rep(4, 'pending')],
      'late',
      -6,
      { daysLate: 6, streak: 0 },
    ),
  },
  {
    key: 'p30',
    label: '30%',
    goal: build('g-30', [...rep(3, 'paid_on_time'), ...rep(7, 'pending')], 'on_track', 5, { streak: 3 }),
  },
  {
    key: 'p70',
    label: '70%',
    goal: build('g-70', [...rep(7, 'paid_on_time'), ...rep(3, 'pending')], 'on_track', 3, { streak: 7 }),
  },
  {
    key: 'p100',
    label: '100%',
    goal: build('g-100', rep(10, 'paid_on_time'), 'done', 0, { streak: 10 }),
  },
];
