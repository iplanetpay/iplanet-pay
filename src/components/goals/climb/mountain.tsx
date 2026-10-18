import { memo, useMemo } from "react";
import { buildTrail, groundY, outlinePath, type SceneSize } from "@/lib/goals/climb/geometry";

/**
 * Montanha: apenas um contorno preto fino (preenchimento neutro só para separar do céu)
 * e a trilha tracejada. Sem texturas nem hachuras.
 * Os traços usam vector-effect: non-scaling-stroke → espessura constante com o zoom.
 */
export const INK = "#111113";
const ns = { vectorEffect: "non-scaling-stroke" as const };

interface Props {
  size: SceneSize;
  fill: string;
}

export const Mountain = memo(function Mountain({ size, fill }: Props) {
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
    </g>
  );
});
