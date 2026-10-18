import type { Deposit } from '@/lib/goals/climb/types';
import type { Trail } from '@/lib/goals/climb/geometry';

/**
 * Marcos de pagamento (pequenos e discretos):
 * verde ✓ pago no prazo · amarelo ✓ pago fora do prazo · vermelho ✗ atrasado · contorno azul a vencer.
 */
interface Props {
  deposits: Deposit[];
  trail: Trail;
  r: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

const GREEN = '#30d158';
const YELLOW = '#ffcc00';
const RED = '#ff453a';
const BLUE = "#0071e3";

export function Milestones({ deposits, trail, r, selected, onSelect }: Props) {
  const n = deposits.length;
  const nextId = (deposits.find((d) => d.status === 'missed') ?? deposits.find((d) => d.status === 'pending'))?.id;
  return (
    <g>
      {deposits.map((d, i) => {
        if (i === n - 1) return null; // o último aporte é o próprio prêmio
        const p = trail.pointAt((i + 1) / n);
        const fill = d.status === 'paid_on_time' ? GREEN : d.status === 'paid_late' ? YELLOW : d.status === 'missed' ? RED : '#ffffff';
        const sel = selected === d.id;
        const ink = d.status === 'pending' ? BLUE : '#ffffff';
        return (
          <g
            key={d.id}
            transform={`translate(${p.x},${p.y})`}
            className="milestone"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(sel ? null : d.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <g className="ms-in">
              <circle r={r * 3.2} fill="transparent" />
              {d.id === nextId && <circle r={r * 1.6} fill="none" stroke={BLUE} strokeWidth="1.2" vectorEffect="non-scaling-stroke" className="ms-pulse" />}
              <circle
                r={r * (sel ? 1.35 : 1.05)}
                fill={fill}
                stroke={d.status === 'pending' ? BLUE : '#ffffff'}
                strokeWidth={d.status === 'pending' ? 1.6 : 1.4}
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.22))' }}
              />
              {(d.status === 'paid_on_time' || d.status === 'paid_late') && (
                <path d={`M${-r * 0.48},${r * 0.04} L${-r * 0.12},${r * 0.4} L${r * 0.52},${-r * 0.36}`} fill="none" stroke={d.status === 'paid_late' ? '#7a5b00' : ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              )}
              {d.status === 'missed' && (
                <path d={`M${-r * 0.38},${-r * 0.38} L${r * 0.38},${r * 0.38} M${r * 0.38},${-r * 0.38} L${-r * 0.38},${r * 0.38}`} fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}
