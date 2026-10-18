import { addCalendarDays, type PlanContribution } from "../reservations/contribution-plan.ts";
import { resolveContributionSlots, type InstallmentStatus } from "./calendar-marks.ts";

export type GoalHealth = "on_track" | "near_late" | "late" | "complete";

export type RopeMark = "upcoming" | "on_time" | "late";

/** Base of the route first, summit last. Y grows downward. */
const TRAIL_PATH: ReadonlyArray<readonly [number, number]> = [
  [96, 332],
  [168, 286],
  [246, 240],
  [318, 196],
  [392, 152],
  [468, 108],
  [528, 68],
];

export function goalHealthLabel(health: GoalHealth): string {
  switch (health) {
    case "on_track":
      return "Em dia";
    case "near_late":
      return "Perto de atrasar";
    case "late":
      return "Atrasada";
    case "complete":
      return "Concluída";
    default: {
      const _exhaustive: never = health;
      throw new Error(`Saúde inválida: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Concluída at 100%. Atrasada when a due date passed unpaid.
 * Perto de atrasar when the next open due date is today or tomorrow.
 */
export function goalHealth(input: {
  today: string;
  dueDates: string[];
  contributions: PlanContribution[];
  progressPercent: number;
}): GoalHealth {
  if (input.progressPercent >= 100) return "complete";
  const slots = resolveContributionSlots({
    dates: input.dueDates,
    today: input.today,
    contributions: input.contributions,
  });
  if (slots.some((slot) => slot.status === "missed")) return "late";
  const next = slots.find((slot) => slot.status === "upcoming");
  if (next && next.dueDate <= addCalendarDays(input.today, 1)) return "near_late";
  return "on_track";
}

/** Upcoming is a blue ring. On time is a green check. Late or missed is a red mark. */
export function ropeMark(status: InstallmentStatus): RopeMark {
  switch (status) {
    case "upcoming":
      return "upcoming";
    case "on_time":
      return "on_time";
    case "late_payment":
    case "missed":
      return "late";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Status inválido: ${String(_exhaustive)}`);
    }
  }
}

export function trailPathPoints(): string {
  return TRAIL_PATH.map(([x, y]) => `${x},${y}`).join(" ");
}

export function trailPoint(progress: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, progress));
  const segments = TRAIL_PATH.length - 1;
  const scaled = clamped * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const local = segments === 0 ? 0 : scaled - index;
  const [x1, y1] = TRAIL_PATH[index];
  const [x2, y2] = TRAIL_PATH[Math.min(TRAIL_PATH.length - 1, index + 1)];
  return {
    x: x1 + (x2 - x1) * local,
    y: y1 + (y2 - y1) * local,
  };
}

/**
 * One rope point per aporte. The first sits at the base and the last at the summit.
 * A single aporte is the summit, because it is also the last.
 */
export function ropePoints(count: number): { x: number; y: number }[] {
  if (count <= 0) return [];
  if (count === 1) return [trailPoint(1)];
  return Array.from({ length: count }, (_, index) => trailPoint(index / (count - 1)));
}

export type SupplyId = "mochila" | "corda" | "casaco" | "comida" | "lanterna";

const SUPPLY_STEPS: readonly SupplyId[] = ["mochila", "corda", "casaco", "comida", "lanterna"];

export type DayPhase = "day" | "night";

export type WeatherKind = "clear" | "calm" | "wind" | "rain" | "snow" | "storm";

export type ExternalWeather = "clear" | "wind" | "rain" | "snow" | "storm";

export type ClimbMotion = "confident" | "slow" | "slip" | "celebrate";

export type JourneyPreview =
  | "live"
  | "on_track"
  | "near_late"
  | "late"
  | "progress_30"
  | "progress_70"
  | "progress_100";

export type JourneyWeather = {
  kind: WeatherKind;
  density: number;
  phase: DayPhase;
};

function clampProgress(progressPercent: number): number {
  if (!Number.isFinite(progressPercent)) return 0;
  return Math.max(0, Math.min(100, progressPercent));
}

/** Local hour. Day is 6:00–17:59; night is the rest of the clock. */
export function dayPhase(hour: number): DayPhase {
  const normalized = ((Math.floor(hour) % 24) + 24) % 24;
  return normalized >= 6 && normalized < 18 ? "day" : "night";
}

/**
 * Supplies appear only while the climb is on time or already finished.
 * On time they unlock with progress, starting with the pack.
 */
export function suppliesFor(health: GoalHealth, progressPercent: number): SupplyId[] {
  switch (health) {
    case "late":
    case "near_late":
      return [];
    case "complete":
      return [...SUPPLY_STEPS];
    case "on_track": {
      const progress = clampProgress(progressPercent);
      const count =
        progress >= 80 ? 5 : progress >= 60 ? 4 : progress >= 40 ? 3 : progress >= 20 ? 2 : 1;
      return SUPPLY_STEPS.slice(0, count);
    }
    default: {
      const _exhaustive: never = health;
      throw new Error(`Saúde inválida: ${String(_exhaustive)}`);
    }
  }
}

/** OpenWeatherMap condition codes, without calling the network. */
export function mapOpenWeather(input: { code: number; windSpeed: number }): ExternalWeather {
  const code = input.code;
  if (code >= 200 && code < 300) return "storm";
  if (code >= 600 && code < 700) return "snow";
  if ((code >= 300 && code < 400) || (code >= 500 && code < 600)) return "rain";
  if (code >= 700 && code < 800) return "wind";
  if (input.windSpeed >= 10) return "wind";
  return "clear";
}

function pleasantWeather(phase: DayPhase, external: ExternalWeather | null | undefined): WeatherKind {
  const source = external ?? "clear";
  switch (source) {
    case "clear":
      return phase === "day" ? "clear" : "calm";
    case "wind":
      return "wind";
    case "rain":
      return "rain";
    case "snow":
      return "snow";
    case "storm":
      return "storm";
    default: {
      const _exhaustive: never = source;
      throw new Error(`Tempo inválido: ${String(_exhaustive)}`);
    }
  }
}

function worsenedWeather(phase: DayPhase, external: ExternalWeather | null | undefined): WeatherKind {
  const source = external ?? "clear";
  switch (source) {
    case "clear":
      return phase === "day" ? "rain" : "wind";
    case "wind":
      return "wind";
    case "rain":
      return "rain";
    case "snow":
      return "snow";
    case "storm":
      return "storm";
    default: {
      const _exhaustive: never = source;
      throw new Error(`Tempo inválido: ${String(_exhaustive)}`);
    }
  }
}

/**
 * On time, missing weather data is a clear day or a calm night.
 * Near late thickens that forecast. Late is a storm at any hour.
 */
export function journeyWeather(input: {
  health: GoalHealth;
  hour: number;
  external?: ExternalWeather | null;
}): JourneyWeather {
  const phase = dayPhase(input.hour);
  switch (input.health) {
    case "late":
      return { kind: "storm", density: 3, phase };
    case "near_late":
      return { kind: worsenedWeather(phase, input.external), density: 2, phase };
    case "on_track":
    case "complete":
      return { kind: pleasantWeather(phase, input.external), density: 1, phase };
    default: {
      const _exhaustive: never = input.health;
      throw new Error(`Saúde inválida: ${String(_exhaustive)}`);
    }
  }
}

export function climbMotion(health: GoalHealth): ClimbMotion {
  switch (health) {
    case "on_track":
      return "confident";
    case "near_late":
      return "slow";
    case "late":
      return "slip";
    case "complete":
      return "celebrate";
    default: {
      const _exhaustive: never = health;
      throw new Error(`Saúde inválida: ${String(_exhaustive)}`);
    }
  }
}

/** Example switch. Live progress stays, except the percent previews and the summit. */
export function previewScene(
  preview: JourneyPreview,
  live: { health: GoalHealth; progressPercent: number },
): { health: GoalHealth; progressPercent: number } {
  const progress = clampProgress(live.progressPercent);
  switch (preview) {
    case "live":
      return { health: live.health, progressPercent: progress };
    case "on_track":
      return { health: "on_track", progressPercent: progress >= 100 ? 50 : progress };
    case "near_late":
      return { health: "near_late", progressPercent: Math.min(progress, 99) };
    case "late":
      return { health: "late", progressPercent: Math.min(progress, 99) };
    case "progress_30":
      return { health: "on_track", progressPercent: 30 };
    case "progress_70":
      return { health: "on_track", progressPercent: 70 };
    case "progress_100":
      return { health: "complete", progressPercent: 100 };
    default: {
      const _exhaustive: never = preview;
      throw new Error(`Prévia inválida: ${String(_exhaustive)}`);
    }
  }
}
