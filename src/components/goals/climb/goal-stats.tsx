import type { GoalState } from '@/lib/goals/climb/types';
import { brl, formatDate, nextDeposit, percentOf, relativeDue, statusInfo } from '@/lib/goals/climb/goal-logic';
import { PROGRESS_RING_BLUE, ProgressRing } from './progress-ring';

/** Painel lateral: anel de progresso e lista agrupada (estilo iOS). */
export function GoalStats({ goal, onDeposit }: { goal: GoalState; onDeposit?: (g: GoalState) => void }) {
  const percent = percentOf(goal);
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const nd = nextDeposit(goal);
  const info = statusInfo(goal.status);
  const paid = goal.deposits.filter((d) => d.status.startsWith('paid')).length;

  return (
    <div className="stats">
      <section className="card glass-card goal-card">
        <div className="goal-top">
          <div>
            <span className={`dot-label tone-${info.tone}`}>
              <i /> {info.label}
            </span>
            <h2>{goal.name}</h2>
            <p className="muted">{goal.product.name}</p>
          </div>
          <ProgressRing percent={percent} size={96} stroke={7} color={goal.status === "late" ? "#ff453a" : PROGRESS_RING_BLUE} />
        </div>
        <p className="status-msg">{info.message}</p>
        <div className="amounts">
          <strong>{brl(goal.savedAmount)}</strong>
          <span className="muted">de {brl(goal.targetAmount)}</span>
        </div>
      </section>

      <section className="card glass-card list">
        <div className="row">
          <span>Falta para concluir</span>
          <strong>{goal.status === 'done' ? 'R$ 0' : brl(remaining)}</strong>
        </div>
        <div className="row">
          <span>{goal.status === 'late' ? 'Aporte em atraso' : 'Próximo aporte'}</span>
          {nd && goal.status !== 'done' ? (
            <strong className={goal.status === 'late' ? 'bad' : ''}>
              {formatDate(nd.dueDate)} · {brl(nd.amount)}
              <small>{relativeDue(nd.dueDate)}</small>
            </strong>
          ) : (
            <strong>—</strong>
          )}
        </div>
        <div className="row">
          <span>Aportes feitos</span>
          <strong>
            {paid} de {goal.deposits.length}
          </strong>
        </div>
        <div className="row">
          <span>Sequência em dia</span>
          <strong>{goal.streak ?? 0}</strong>
        </div>
      </section>

      {goal.status !== 'done' && (
        <button type="button" className="cta" onClick={() => onDeposit?.(goal)}>
          {goal.status === 'late' ? 'Aportar agora' : 'Fazer aporte'}
        </button>
      )}
    </div>
  );
}
