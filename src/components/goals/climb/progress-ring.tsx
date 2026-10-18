import { animate } from 'framer-motion';
import { useEffect, useState } from 'react';

/** Anel de progresso fino. `size` em px; mostra o percentual no centro quando `label`. */
export function ProgressRing({ percent, size = 120, stroke = 8, label = true, color = '#0a84ff' }: { percent: number; size?: number; stroke?: number; label?: boolean; color?: string }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const c = animate(0, percent, { duration: 1.6, ease: [0.25, 0.1, 0.25, 1], onUpdate: setP });
    return () => c.stop();
  }, [percent]);
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(120,120,128,0.16)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label && (
        <span className="ring-num">
          {Math.round(p)}
          <small>%</small>
        </span>
      )}
    </div>
  );
}
