/**
 * Geometria da montanha e da trilha (coordenadas de mundo).
 * Dois formatos: paisagem (desktop) e retrato (mobile). A forma é definida em
 * coordenadas normalizadas 0–1 e escalada para cada formato.
 */

export interface SceneSize {
  W: number;
  H: number;
  /** escala do escalador / marcadores neste formato */
  cs: number;
  portrait: boolean;
}
export const LANDSCAPE: SceneSize = { W: 800, H: 520, cs: 1, portrait: false };
export const PORTRAIT: SceneSize = { W: 520, H: 700, cs: 0.7, portrait: true };

type P = [number, number];

/** Silhueta simplificada da montanha (apenas contorno). */
const SILHOUETTE: P[] = [
  [-0.04, 1.0],
  [-0.04, 0.8],
  [0.14, 0.58],
  [0.26, 0.46],
  [0.33, 0.5],
  [0.46, 0.27],
  [0.545, 0.118],
  [0.61, 0.118],
  [0.7, 0.26],
  [0.83, 0.44],
  [0.95, 0.68],
  [1.04, 0.86],
  [1.04, 1.0],
];

/** Pontos de dobra da trilha em zigue-zague, da base ao cume. */
const TRAIL: P[] = [
  [0.16, 0.925],
  [0.8, 0.83],
  [0.3, 0.71],
  [0.74, 0.585],
  [0.43, 0.465],
  [0.66, 0.335],
  [0.585, 0.215],
  [0.572, 0.118],
];

/** A montanha ocupa só a parte de baixo da cena; o topo livre abre espaço para céu, sol e prêmio. */
const yMap = (s: SceneSize) => (s.portrait ? { y0: 0.27, ys: 0.63 } : { y0: 0.16, ys: 0.74 });
const sc = (pts: P[], s: SceneSize): P[] => {
  const { y0, ys } = yMap(s);
  return pts.map(([x, y]) => [x * s.W, (y0 + y * ys) * s.H]);
};

export function silhouettePoints(s: SceneSize): P[] {
  return sc(SILHOUETTE, s);
}

/** Contorno com cantos suavizados nos picos. */
export function outlinePath(s: SceneSize): string {
  const pts = silhouettePoints(s);
  const r = 14 * s.cs;
  let d = `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`;
  for (let i = 2; i < pts.length - 2; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const lab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const lbc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const rr = Math.min(r, lab * 0.4, lbc * 0.4);
    const p1: P = [b[0] + ((a[0] - b[0]) / lab) * rr, b[1] + ((a[1] - b[1]) / lab) * rr];
    const p2: P = [b[0] + ((c[0] - b[0]) / lbc) * rr, b[1] + ((c[1] - b[1]) / lbc) * rr];
    d += ` L${p1[0].toFixed(1)},${p1[1].toFixed(1)} Q${b[0].toFixed(1)},${b[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const n = pts.length;
  d += ` L${pts[n - 2][0]},${pts[n - 2][1]} L${pts[n - 1][0]},${pts[n - 1][1]} Z`;
  return d;
}

export interface TrailPoint {
  x: number;
  y: number;
  /** tangente normalizada no sentido da subida */
  tx: number;
  ty: number;
}

export interface Trail {
  d: string;
  length: number;
  pointAt(t: number): TrailPoint;
  /** path SVG do início até t (0–1) */
  pathUpTo(t: number): string;
}

/** Trilha com cantos arredondados + amostragem própria (sem depender do DOM). */
export function buildTrail(s: SceneSize): Trail {
  const pts = sc(TRAIL, s);
  const r = 26 * s.cs;
  const segs: Array<{ x0: number; y0: number; x1: number; y1: number; cx?: number; cy?: number }> = [];
  let d = `M${pts[0][0]},${pts[0][1]}`;
  let cur: P = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const lab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const lbc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const rr = Math.min(r, lab * 0.45, lbc * 0.45);
    const p1: P = [b[0] + ((a[0] - b[0]) / lab) * rr, b[1] + ((a[1] - b[1]) / lab) * rr];
    const p2: P = [b[0] + ((c[0] - b[0]) / lbc) * rr, b[1] + ((c[1] - b[1]) / lbc) * rr];
    segs.push({ x0: cur[0], y0: cur[1], x1: p1[0], y1: p1[1] });
    segs.push({ x0: p1[0], y0: p1[1], x1: p2[0], y1: p2[1], cx: b[0], cy: b[1] });
    d += ` L${p1[0].toFixed(1)},${p1[1].toFixed(1)} Q${b[0].toFixed(1)},${b[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    cur = p2;
  }
  const last = pts[pts.length - 1];
  segs.push({ x0: cur[0], y0: cur[1], x1: last[0], y1: last[1] });
  d += ` L${last[0].toFixed(1)},${last[1].toFixed(1)}`;

  // amostragem densa
  const samples: Array<{ x: number; y: number; len: number }> = [];
  let acc = 0;
  let prev: { x: number; y: number } | null = null;
  const push = (x: number, y: number) => {
    if (prev) acc += Math.hypot(x - prev.x, y - prev.y);
    samples.push({ x, y, len: acc });
    prev = { x, y };
  };
  for (const sg of segs) {
    const n = sg.cx === undefined ? 12 : 10;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      if (sg.cx === undefined) push(sg.x0 + (sg.x1 - sg.x0) * u, sg.y0 + (sg.y1 - sg.y0) * u);
      else {
        const v = 1 - u;
        push(
          v * v * sg.x0 + 2 * v * u * sg.cx + u * u * sg.x1,
          v * v * sg.y0 + 2 * v * u * (sg.cy as number) + u * u * sg.y1,
        );
      }
    }
  }
  const length = acc;
  const pointAt = (t: number): TrailPoint => {
    const target = Math.max(0, Math.min(1, t)) * length;
    let lo = 0;
    let hi = samples.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (samples[m].len < target) lo = m;
      else hi = m;
    }
    const a = samples[lo];
    const b = samples[hi];
    const span = b.len - a.len || 1;
    const u = (target - a.len) / span;
    // tangente suavizada: usa janela de amostras ao redor
    const a2 = samples[Math.max(0, lo - 2)];
    const b2 = samples[Math.min(samples.length - 1, hi + 2)];
    const dx = b2.x - a2.x;
    const dy = b2.y - a2.y;
    const dl = Math.hypot(dx, dy) || 1;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, tx: dx / dl, ty: dy / dl };
  };
  const pathUpTo = (t: number): string => {
    const target = Math.max(0, Math.min(1, t)) * length;
    if (target <= 0.5) return '';
    let out = `M${samples[0].x.toFixed(1)},${samples[0].y.toFixed(1)}`;
    for (const sp of samples) {
      if (sp.len > target) break;
      out += ` L${sp.x.toFixed(1)},${sp.y.toFixed(1)}`;
    }
    const e = pointAt(t);
    return out + ` L${e.x.toFixed(1)},${e.y.toFixed(1)}`;
  };
  return { d, length, pointAt, pathUpTo };
}

/** Y (mundo) da linha do chão, onde termina a silhueta. Abaixo dela fica a faixa de chão. */
export const groundY = (s: SceneSize) => {
  const { y0, ys } = yMap(s);
  return (y0 + ys) * s.H;
};
