import type { TimeOfDayPreset } from '@/lib/goals/climb/types';
import { GOAL_PRESETS } from '@/lib/goals/climb/dev-presets';

interface Props {
  presetKey: string;
  onPreset: (k: string) => void;
  time: TimeOfDayPreset;
  onTime: (t: TimeOfDayPreset) => void;
}

const TIMES: Array<[TimeOfDayPreset, string]> = [
  ['real', 'Horário real'],
  ['morning', 'Manhã'],
  ['afternoon', 'Tarde'],
  ['dusk', 'Entardecer'],
  ['night', 'Noite'],
];

/** Painel de testes (recolhido por padrão). Não faz parte do produto. */
export function DemoPanel({ presetKey, onPreset, time, onTime }: Props) {
  return (
    <details className="demo glass-card" aria-label="Painel de testes">
      <summary>
        <span>Painel de testes</span>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
          <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="demo-body">
        <div className="demo-row">
          <span className="demo-k">Estado da meta</span>
          <div className="chips">
            <button
              type="button"
              className={presetKey === "live" || presetKey === "" ? "on" : ""}
              onClick={() => onPreset("live")}
              data-preset="live"
            >
              Ao vivo
            </button>
            {GOAL_PRESETS.map((p) => (
              <button type="button" key={p.key} className={presetKey === p.key ? "on" : ""} onClick={() => onPreset(p.key)} data-preset={p.key}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="demo-row">
          <span className="demo-k">Horário</span>
          <div className="chips">
            {TIMES.map(([k, l]) => (
              <button type="button" key={k} className={time === k ? "on" : ""} onClick={() => onTime(k)} data-time={k}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
