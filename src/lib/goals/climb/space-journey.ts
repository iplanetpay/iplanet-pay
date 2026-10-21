/**
 * Viagem até o planeta iPlanet (substitui a escalada da montanha).
 * Lógica pura, espelhada do app iOS (IPlanetCore/SpaceJourney.swift):
 * ritmo do foguete, rota curva e tom da nebulosa.
 */
import type { GoalStatus } from "./types.ts";

export interface RocketMotionProfile {
  /** 1 = ritmo normal; menor = mais lento. */
  pace: number;
  /** Balanço lateral (0–1). */
  wobble: number;
  /** Turbulência (tremor rápido, 0–1). */
  turbulence: number;
}

export function rocketProfile(status: GoalStatus): RocketMotionProfile {
  switch (status) {
    case "on_track":
      return { pace: 1, wobble: 0, turbulence: 0 };
    case "near_late":
      return { pace: 0.72, wobble: 0.5, turbulence: 0.15 };
    case "late":
      return { pace: 0.48, wobble: 0.8, turbulence: 1 };
    case "done":
      return { pace: 0.9, wobble: 0, turbulence: 0 };
    default: {
      const exhaustive: never = status;
      throw new Error(`Status inválido: ${String(exhaustive)}`);
    }
  }
}

/** Duração total (s) da viagem até o percentual: cruzeiro + parada suave. */
const CRUISE_S = 2.4;
/** Parada cúbica que começa na mesma velocidade do cruzeiro (sem tranco). */
const EASE_S = (CRUISE_S * 0.18 * 3) / 0.82;

export function rocketDuration(profile: RocketMotionProfile): number {
  return (CRUISE_S + EASE_S) / profile.pace;
}

export interface RocketSample {
  progress: number;
  speed: number;
  /** Intensidade da chama 0–1, proporcional à velocidade. */
  flame: number;
}

/**
 * Progresso em `elapsed` segundos: velocidade constante em 82% do caminho
 * e desaceleração cúbica no final (sem salto de velocidade).
 */
export function sampleRocket(profile: RocketMotionProfile, target: number, elapsed: number): RocketSample {
  const t = Math.max(0, Math.min(1, target));
  if (t <= 0 || elapsed <= 0) return { progress: elapsed > 0 ? t : 0, speed: 0, flame: 0 };
  const cruise = CRUISE_S / profile.pace;
  const ease = EASE_S / profile.pace;
  if (elapsed >= cruise + ease) return { progress: t, speed: 0, flame: 0 };
  const maxSpeed = 0.82 / cruise;
  if (elapsed < cruise) {
    const speed = (t * 0.82) / cruise;
    return { progress: speed * elapsed, speed, flame: Math.min(1, speed / maxSpeed) };
  }
  const u = (elapsed - cruise) / ease;
  const speed = (t * 0.18 * 3 * (1 - u) ** 2) / ease;
  return {
    progress: t * (0.82 + 0.18 * (1 - (1 - u) ** 3)),
    speed,
    flame: Math.min(1, speed / maxSpeed),
  };
}

export interface RocketPose {
  x: number;
  y: number;
  /** Ângulo da tangente em radianos (0 = para a direita). */
  angle: number;
}

export interface RouteSize {
  W: number;
  H: number;
}

/** Cena retrato (igual ao iOS) e paisagem para telas largas. */
export const SPACE_PORTRAIT: RouteSize = { W: 520, H: 700 };
export const SPACE_LANDSCAPE: RouteSize = { W: 960, H: 560 };

export interface RocketRoute {
  size: RouteSize;
  earth: { x: number; y: number };
  planet: { x: number; y: number };
  length: number;
  pointAt(progress: number): RocketPose;
  /** Uma estação por aporte, exceto o último (que é o próprio planeta). */
  stations(count: number): RocketPose[];
  /** Caminho SVG da Terra até `progress`. */
  pathTo(progress: number): string;
}

/** Rota cúbica curva da Terra (embaixo à esquerda) até o planeta (em cima à direita). */
export function planetRadius(size: RouteSize): number {
  return Math.min(size.W, size.H) * 0.105;
}

/**
 * A rota termina na borda do planeta (o foguete pousa sobre ele), não no centro.
 * `planet` continua sendo o centro do planeta.
 */
export function buildRoute(size: RouteSize, steps = 240): RocketRoute {
  const landscape = size.W > size.H;
  const k = (x: number, y: number) => ({ x: x * size.W, y: y * size.H });
  const p0 = landscape ? k(0.11, 0.8) : k(110 / 520, 610 / 700);
  const p1 = landscape ? k(0.42, 1.02) : k(470 / 520, 520 / 700);
  const p2 = landscape ? k(0.48, 0.12) : k(40 / 520, 250 / 700);
  const center = landscape ? k(0.82, 0.3) : k(395 / 520, 135 / 700);
  const r = planetRadius(size) * 1.25;
  const dx = p2.x - center.x;
  const dy = p2.y - center.y;
  const d = Math.hypot(dx, dy) || 1;
  const p3 = { x: center.x + (dx / d) * r, y: center.y + (dy / d) * r };
  const samples: Array<{ x: number; y: number; len: number }> = [];
  let total = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const m = 1 - t;
    const x = m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x;
    const y = m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y;
    const last = samples[samples.length - 1];
    if (last) total += Math.hypot(x - last.x, y - last.y);
    samples.push({ x, y, len: total });
  }
  const pointAt = (progress: number): RocketPose => {
    const target = Math.max(0, Math.min(1, progress)) * total;
    let lo = 0;
    let hi = samples.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].len < target) lo = mid;
      else hi = mid;
    }
    const a = samples[lo];
    const b = samples[hi];
    const span = b.len - a.len;
    const u = span === 0 ? 0 : (target - a.len) / span;
    const a2 = samples[Math.max(0, lo - 1)];
    const b2 = samples[Math.min(samples.length - 1, hi + 1)];
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, angle: Math.atan2(b2.y - a2.y, b2.x - a2.x) };
  };
  return {
    size,
    earth: p0,
    planet: center,
    length: total,
    pointAt,
    stations(count) {
      if (count <= 1) return [];
      return Array.from({ length: count - 1 }, (_, i) => pointAt((i + 1) / count));
    },
    pathTo(progress) {
      const limit = Math.max(0, Math.min(1, progress)) * total;
      const pts = samples.filter((s) => s.len <= limit);
      const end = pointAt(progress);
      pts.push({ ...end, len: limit });
      return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    },
  };
}

export interface NebulaTint {
  top: string;
  bottom: string;
  glow: string;
  period: "dia" | "entardecer" | "noite";
}

/** Tom da nebulosa pela hora local: dia azul profundo, entardecer magenta, noite/madrugada roxa. */
export function nebulaTint(hour: number): NebulaTint {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 6 && h < 17) return { top: "rgb(8,18,52)", bottom: "rgb(22,54,128)", glow: "rgb(64,140,255)", period: "dia" };
  if (h >= 17 && h < 20) return { top: "rgb(24,10,48)", bottom: "rgb(92,30,96)", glow: "rgb(255,110,160)", period: "entardecer" };
  return { top: "rgb(4,4,18)", bottom: "rgb(28,16,70)", glow: "rgb(140,90,255)", period: "noite" };
}

/** Hora para o painel de testes. */
export function presetHour(preset: "real" | "morning" | "afternoon" | "dusk" | "night", now = new Date()): number {
  switch (preset) {
    case "morning":
      return 9;
    case "afternoon":
      return 15;
    case "dusk":
      return 18.5;
    case "night":
      return 23;
    default:
      return now.getHours() + now.getMinutes() / 60;
  }
}

/** Gerador determinístico (estrelas iguais no servidor e no cliente). */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
