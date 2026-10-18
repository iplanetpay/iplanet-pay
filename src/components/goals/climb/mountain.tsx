import { memo, useMemo } from 'react';
import type { PrizeKind } from '@/lib/goals/climb/types';
import { buildTrail, groundY, outlinePath, type SceneSize } from '@/lib/goals/climb/geometry';

/**
 * Montanha: apenas um contorno preto fino (preenchimento neutro só para separar do céu),
 * a trilha tracejada e o prêmio no cume. Sem texturas nem hachuras.
 * Os traços usam vector-effect: non-scaling-stroke → espessura constante com o zoom.
 */
export const INK = '#111113';
const ns = { vectorEffect: 'non-scaling-stroke' as const };

interface Props {
  size: SceneSize;
  fill: string;
  unit: number;
  prize: PrizeKind;
  done: boolean;
}

export const Mountain = memo(function Mountain({ size, fill, unit, prize, done }: Props) {
  const geo = useMemo(() => {
    const trail = buildTrail(size);
    return { outline: outlinePath(size), trail, start: trail.pointAt(0), summit: trail.pointAt(1) };
  }, [size]);
  const { W, H, cs } = size;
  const gy = groundY(size);

  return (
    <g>
      {/* corpo + contorno */}
      <path d={geo.outline} fill={fill} />
      <path d={geo.outline} fill="url(#mtnShade)" />
      {/* chão */}
      <rect x="-4" y={gy} width={W + 8} height={H - gy + 4} fill="rgba(255,255,255,0.35)" />
      <line x1="-4" x2={W + 4} y1={gy} y2={gy} stroke={INK} strokeWidth="1.5" {...ns} />
      {/* trilha tracejada (o trecho percorrido é desenhado em azul pelo ClimbScene) */}
      <path d={geo.trail.d} fill="none" stroke="#8e8e93" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.5 6" opacity="0.9" {...ns} />
      <path d={geo.outline} fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" {...ns} />

      {/* início */}
      <circle cx={geo.start.x} cy={geo.start.y} r={4.5 * cs} fill="#fff" stroke={INK} strokeWidth="1.4" {...ns} />

      {/* prêmio sobre o cume */}
      <g transform={`translate(${geo.summit.x}, ${geo.summit.y - 66 * unit}) scale(${unit})`}>
        <Prize kind={prize} done={done} />
      </g>
    </g>
  );
});

/** Ícone do produto — contorno fino; brilho suave quando conquistado. */
export function Prize({ kind, done }: { kind: PrizeKind; done: boolean }) {
  const p = { fill: 'none', stroke: INK, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...ns };
  return (
    <g>
      <circle r="38" fill="url(#prizeGlow)" opacity={done ? 1 : 0.5} className="prize-glow" />
      <circle r="22" fill="#fff" stroke={INK} strokeWidth="1.5" {...ns} />
      <g className="prize-float">
        {kind === 'phone' && (
          <g {...p}>
            <rect x="-6.5" y="-12" width="13" height="24" rx="3.4" {...ns} />
            <path d="M-2 -9h4" {...ns} />
          </g>
        )}
        {kind === 'laptop' && (
          <g {...p}>
            <rect x="-10" y="-9" width="20" height="13" rx="1.6" {...ns} />
            <path d="M-13 8h26" {...ns} />
          </g>
        )}
        {kind === 'headphones' && (
          <g {...p}>
            <path d="M-9 4v-3a9 9 0 0 1 18 0v3" {...ns} />
            <rect x="-11.5" y="2" width="5" height="9" rx="2.4" {...ns} />
            <rect x="6.5" y="2" width="5" height="9" rx="2.4" {...ns} />
          </g>
        )}
        {kind === 'gift' && (
          <g {...p}>
            <rect x="-10" y="-3" width="20" height="14" {...ns} />
            <rect x="-11.5" y="-8" width="23" height="5" {...ns} />
            <path d="M0 -8v19" {...ns} />
          </g>
        )}
      </g>
    </g>
  );
}
