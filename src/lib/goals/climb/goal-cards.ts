import { isContributionFrequency, type ContributionFrequency } from "../../reservations/contribution-plan.ts";
import type { GoalCalendarData } from "../goal-calendar.ts";
import type { GoalState } from "./types.ts";

/** Uma meta já convertida para a escalada, com o link do aporte e o calendário. */
export interface ClimbGoalEntry {
  goal: GoalState;
  depositHref: string;
  calendar: GoalCalendarData | null;
  today: string;
}

type ClimbableFields = {
  status: string;
  reservation_id: string | null;
  frequency: string | null;
  plan_start_date: string | null;
};

/**
 * A escalada só existe para meta ativa com reserva, frequência e data de início.
 * Sem isso não há agenda para derivar o status.
 */
export function isClimbableGoal<T extends ClimbableFields>(
  goal: T,
): goal is T & {
  reservation_id: string;
  frequency: ContributionFrequency;
  plan_start_date: string;
} {
  return (
    goal.status === "active" &&
    Boolean(goal.reservation_id) &&
    isContributionFrequency(goal.frequency) &&
    Boolean(goal.plan_start_date)
  );
}

/** Acha a meta do link (`?meta=`). Id desconhecido volta para a grade. */
export function selectClimbGoal(
  entries: ClimbGoalEntry[],
  id: string | null | undefined,
): ClimbGoalEntry | null {
  const key = id?.trim();
  if (!key) return null;
  return entries.find((entry) => entry.goal.id === key) ?? null;
}
