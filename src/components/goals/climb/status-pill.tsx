import type { GoalState } from '@/lib/goals/climb/types';
import { percentOf, statusInfo } from '@/lib/goals/climb/goal-logic';
import { ProgressRing } from './progress-ring';

/** Indicador de status discreto: anel mínimo + rótulo ("Em dia", "Quase atrasada"...). */
export function StatusPill({ goal }: { goal: GoalState }) {
  const info = statusInfo(goal.status);
  return (
    <div className={`status-pill glass tone-${info.tone}`} aria-label={`Status da meta: ${info.label}, ${Math.round(percentOf(goal))}%`}>
      <ProgressRing percent={percentOf(goal)} size={22} stroke={3} label={false} color="currentColor" />
      <span className="sp-label">{info.label}</span>
      <span className="sp-pct">{Math.round(percentOf(goal))}%</span>
    </div>
  );
}
