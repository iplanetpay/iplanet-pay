import Link from "next/link";
import type { ClimbGoalEntry } from "@/lib/goals/climb/goal-cards";
import { percentOf, statusInfo } from "@/lib/goals/climb/goal-logic";
import { PROGRESS_RING_BLUE, ProgressRing } from "./progress-ring";

/** Grade de metas: anel azul com o percentual e o nome. */
export function GoalGrid({ entries }: { entries: ClimbGoalEntry[] }) {
  return (
    <div className="metas-goals">
      <ul className="goal-grid" data-testid="metas-goal-grid">
        {entries.map((entry) => {
          const info = statusInfo(entry.goal.status);
          const percent = percentOf(entry.goal);
          return (
            <li key={entry.goal.id}>
              <Link
                href={`/app/metas?meta=${encodeURIComponent(entry.goal.id)}`}
                className="goal-card"
                data-testid="metas-goal-card"
                data-goal-id={entry.goal.id}
                data-status={entry.goal.status}
                aria-label={`${entry.goal.name}, ${info.label}, ${Math.round(percent)}%`}
              >
                <span className="goal-card-ring">
                  <ProgressRing percent={percent} size={88} stroke={7} color={PROGRESS_RING_BLUE} />
                </span>
                <span className="goal-card-name">{entry.goal.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
