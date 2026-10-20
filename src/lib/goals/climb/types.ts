/**
 * Contrato de dados da escalada de metas (iPlanet Pay).
 * Tudo que o backend de metas/aportes precisa entregar está aqui.
 */

/** Estado de saúde da meta. Controla escalador, clima e mensagens. */
export type GoalStatus = 'on_track' | 'near_late' | 'late' | 'done';

/** Situação de cada aporte agendado. */
export type DepositStatus =
  | 'paid_on_time' // pago no prazo (check verde no calendário)
  | 'paid_late' // pago fora do prazo (amarelo)
  | 'pending' // ainda vai vencer
  | 'missed'; // venceu e não foi pago (X vermelho)

export interface Deposit {
  id: string;
  /** Data limite do aporte (ISO yyyy-mm-dd). */
  dueDate: string;
  /** Valor combinado, em reais. */
  amount: number;
  status: DepositStatus;
  /** Quando foi efetivamente pago (ISO), se foi. */
  paidAt?: string;
}

export type PrizeKind = 'phone' | 'laptop' | 'headphones' | 'gift';

export interface GoalProduct {
  name: string;
  kind: PrizeKind;
}

export interface GoalState {
  id: string;
  /** Nome dado pelo usuário à meta. */
  name: string;
  product: GoalProduct;
  status: GoalStatus;
  /** Valor total da meta (R$). */
  targetAmount: number;
  /** Quanto já foi guardado (R$). */
  savedAmount: number;
  /** 0–100. Se omitido é calculado por savedAmount/targetAmount. */
  percent?: number;
  deposits: Deposit[];
  /** Quantos dias de atraso (quando status = late). */
  daysLate?: number;
  /** Sequência de aportes em dia. */
  streak?: number;
}

export type ViewMode = 'overview' | 'closeup';

export type TimeOfDayPreset = 'real' | 'morning' | 'afternoon' | 'dusk' | 'night';

export interface MetasClimbProps {
  goal: GoalState;
  /** Força a condição do espaço (painel de testes). 'real' = regra da meta. */
  spaceOverride?: import("./space-journey.ts").SpaceCondition | 'real';
  /** Força o horário da nebulosa (painel de testes). */
  timeOverride?: TimeOfDayPreset;
  initialView?: ViewMode;
  onViewChange?: (v: ViewMode) => void;
  /** Chamado pelo botão "Fazer aporte". */
  onDeposit?: (goal: GoalState) => void;
}
