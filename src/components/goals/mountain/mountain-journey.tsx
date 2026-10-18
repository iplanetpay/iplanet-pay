"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pill } from "@/components/ui/pill";
import type { InstallmentStatus } from "@/lib/goals/calendar-marks";
import {
  climbMotion,
  goalHealthLabel,
  journeyWeather,
  previewScene,
  ropeMark,
  ropePoints,
  suppliesFor,
  trailPathPoints,
  trailPoint,
  type ClimbMotion,
  type ExternalWeather,
  type GoalHealth,
  type JourneyPreview,
  type RopeMark,
  type SupplyId,
  type WeatherKind,
} from "@/lib/goals/journey";
import { formatPlanDate } from "@/lib/reservations/contribution-plan";
import { cn } from "@/lib/utils";

export type TrailAporte = {
  dueDate: string;
  status: InstallmentStatus;
};

export type MetasTrail = {
  goalName: string;
  productName: string;
  health: GoalHealth;
  progressPercent: number;
  points: TrailAporte[];
};

const VIEW_W = 640;
const VIEW_H = 400;

const PREVIEWS: { id: JourneyPreview; label: string }[] = [
  { id: "live", label: "Ao vivo" },
  { id: "on_track", label: "Em dia" },
  { id: "near_late", label: "Perto de atrasar" },
  { id: "late", label: "Atrasado" },
  { id: "progress_30", label: "30%" },
  { id: "progress_70", label: "70%" },
  { id: "progress_100", label: "100%" },
];

export function MountainJourney({ trail }: { trail: MetasTrail | null }) {
  const [view, setView] = useState<"longe" | "perto">("longe");
  const [preview, setPreview] = useState<JourneyPreview>("live");
  const [hour, setHour] = useState<number | null>(null);
  const [external, setExternal] = useState<ExternalWeather | null>(null);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadWeather() {
      const first = await readWeather("/api/weather");
      if (cancelled || !first) return;
      if (first.source === "openweather" && isExternalWeather(first.kind)) {
        setExternal(first.kind);
        return;
      }
      if (first.source !== "needs_location" || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          void readWeather(`/api/weather?lat=${lat}&lon=${lon}`).then((next) => {
            if (cancelled || !next || next.source !== "openweather") return;
            if (isExternalWeather(next.kind)) setExternal(next.kind);
          });
        },
        () => {
          /* Location denied: the local forecast stays in place. */
        },
        { maximumAge: 600_000, timeout: 8_000 },
      );
    }
    void loadWeather();
    return () => {
      cancelled = true;
    };
  }, []);

  const scene = previewScene(preview, {
    health: trail?.health ?? "on_track",
    progressPercent: trail?.progressPercent ?? 0,
  });
  const weather = journeyWeather({
    health: scene.health,
    hour: hour ?? 12,
    external,
  });
  const supplies = suppliesFor(scene.health, scene.progressPercent);
  const motionKind = climbMotion(scene.health);
  const climber = trailPoint(scene.progressPercent / 100);
  const remaining = Math.max(0, 100 - Math.round(scene.progressPercent));
  const night = weather.phase === "night";

  return (
    <section className="space-y-4" data-testid="metas-trail">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            {trail ? goalHealthLabel(scene.health) : "Sem meta"}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink)]">
            {trail?.goalName ?? "Nenhuma meta ainda"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {trail
              ? remaining === 0
                ? `${trail.points.length} pontos de corda · no topo`
                : `${trail.points.length} pontos de corda · faltam ${remaining}% para o topo`
              : "Crie uma meta para marcar os aportes na trilha."}
          </p>
        </div>
        {trail ? <HealthPill health={scene.health} /> : null}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Distância da montanha">
        <ViewButton active={view === "longe"} onClick={() => setView("longe")}>
          Longe
        </ViewButton>
        <ViewButton active={view === "perto"} onClick={() => setView("perto")}>
          Perto
        </ViewButton>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Prévia da jornada">
        {PREVIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={preview === item.id}
            onClick={() => setPreview(item.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              preview === item.id
                ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                : "border-[var(--line)] bg-white text-[var(--ink-muted)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className="overflow-hidden rounded-[28px] border border-[var(--line)]"
        data-testid="metas-view"
        data-view={view}
        data-phase={weather.phase}
        data-weather={weather.kind}
        data-weather-density={weather.density}
        data-motion={motionKind}
        data-supplies={supplies.join(" ")}
        style={{ background: night ? "#2c2c30" : "#f7f7f8" }}
      >
        <motion.div
          key={view}
          initial={{ opacity: 1, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {view === "longe" ? (
            <FarMountain
              trail={trail}
              climber={climber}
              night={night}
              weatherKind={weather.kind}
              density={weather.density}
              motionKind={motionKind}
              reduce={reduce}
            />
          ) : (
            <CloseClimb
              night={night}
              weatherKind={weather.kind}
              density={weather.density}
              motionKind={motionKind}
              supplies={supplies}
              reduce={reduce}
            />
          )}
        </motion.div>
      </div>
    </section>
  );
}

function FarMountain({
  trail,
  climber,
  night,
  weatherKind,
  density,
  motionKind,
  reduce,
}: {
  trail: MetasTrail | null;
  climber: { x: number; y: number };
  night: boolean;
  weatherKind: WeatherKind;
  density: number;
  motionKind: ClimbMotion;
  reduce: boolean;
}) {
  const spots = ropePoints(trail?.points.length ?? 0);
  const summit = trailPoint(1);
  const ink = night ? "#f5f5f7" : "#111111";
  const pose = climbPose(motionKind, reduce);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={
        trail
          ? `Montanha de ${trail.goalName} com ${trail.points.length} aportes`
          : "Montanha sem aportes"
      }
    >
      <WeatherMarks kind={weatherKind} density={density} night={night} />
      <MountainSilhouette />
      <polyline
        points={trailPathPoints()}
        fill="none"
        stroke="#0071e3"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {trail
        ? trail.points.map((point, index) => {
            const spot = spots[index];
            if (!spot) return null;
            return (
              <RopePoint
                key={point.dueDate}
                x={spot.x}
                y={spot.y}
                mark={ropeMark(point.status)}
                label={`${formatPlanDate(point.dueDate)} · ${markLabel(ropeMark(point.status))}`}
              />
            );
          })
        : null}
      <ClimberOnTrail x={climber.x} y={climber.y} pose={pose} />
      <text
        x={summit.x - 8}
        y={summit.y - 28}
        textAnchor="middle"
        fill={ink}
        fontSize="13"
        fontWeight="600"
      >
        {(trail?.productName ?? "Topo").slice(0, 22)}
      </text>
    </svg>
  );
}

function CloseClimb({
  night,
  weatherKind,
  density,
  motionKind,
  supplies,
  reduce,
}: {
  night: boolean;
  weatherKind: WeatherKind;
  density: number;
  motionKind: ClimbMotion;
  supplies: SupplyId[];
  reduce: boolean;
}) {
  const pose = climbPose(motionKind, reduce);
  const ink = night ? "#f5f5f7" : "#111111";

  return (
    <div className="grid gap-2 px-6 py-8 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
      <div className="relative mx-auto w-full max-w-[280px]">
        <svg viewBox="0 0 280 220" className="absolute inset-x-0 top-0 h-28 w-full" aria-hidden>
          <WeatherMarks kind={weatherKind} density={density} night={night} compact />
        </svg>
        <motion.div className="relative mx-auto mt-10 w-40" animate={pose.animate} transition={pose.transition}>
          <ClimberOutline />
        </motion.div>
        <p className="mt-3 text-center text-xs font-medium" style={{ color: ink }}>
          {motionCaption(motionKind)}
        </p>
      </div>
      <ul className="flex flex-wrap justify-center gap-3 sm:flex-col sm:justify-end" aria-label="Equipamento">
        {supplies.map((id) => (
          <li key={id} className="flex items-center gap-2 text-xs font-semibold" style={{ color: ink }}>
            <SupplyIcon id={id} />
            {supplyLabel(id)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-semibold",
        active ? "bg-[var(--accent)] text-white" : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)]",
      )}
    >
      {children}
    </button>
  );
}

function HealthPill({ health }: { health: GoalHealth }) {
  return <Pill tone={healthTone(health)}>{goalHealthLabel(health)}</Pill>;
}

function healthTone(health: GoalHealth): "accent" | "success" | "danger" | "neutral" {
  switch (health) {
    case "on_track":
      return "accent";
    case "near_late":
      return "neutral";
    case "late":
      return "danger";
    case "complete":
      return "success";
    default: {
      const _exhaustive: never = health;
      throw new Error(`Saúde inválida: ${String(_exhaustive)}`);
    }
  }
}

function markLabel(mark: RopeMark): string {
  switch (mark) {
    case "upcoming":
      return "A aportar";
    case "on_time":
      return "No prazo";
    case "late":
      return "Atrasado";
    default: {
      const _exhaustive: never = mark;
      throw new Error(`Marca inválida: ${String(_exhaustive)}`);
    }
  }
}

function motionCaption(motionKind: ClimbMotion): string {
  switch (motionKind) {
    case "confident":
      return "Subindo firme";
    case "slow":
      return "Subindo devagar";
    case "slip":
      return "Escorregou e parou";
    case "celebrate":
      return "No topo";
    default: {
      const _exhaustive: never = motionKind;
      throw new Error(`Movimento inválido: ${String(_exhaustive)}`);
    }
  }
}

function supplyLabel(id: SupplyId): string {
  switch (id) {
    case "mochila":
      return "Mochila";
    case "corda":
      return "Corda";
    case "casaco":
      return "Casaco";
    case "comida":
      return "Comida";
    case "lanterna":
      return "Lanterna";
    default: {
      const _exhaustive: never = id;
      throw new Error(`Equipamento inválido: ${String(_exhaustive)}`);
    }
  }
}

function climbPose(motionKind: ClimbMotion, reduce: boolean) {
  if (reduce) {
    return { animate: { y: 0, rotate: 0 }, transition: { duration: 0 } };
  }
  switch (motionKind) {
    case "confident":
      return {
        animate: { y: [0, -8, 0], rotate: [0, -3, 0] },
        transition: { duration: 1.3, repeat: Infinity, ease: "easeInOut" as const },
      };
    case "slow":
      return {
        animate: { y: [0, -3, 0], rotate: [0, -1, 0] },
        transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" as const },
      };
    case "slip":
      return {
        animate: { y: [0, 18, 18], rotate: [0, 12, 12] },
        transition: { duration: 1.2, repeat: Infinity, repeatDelay: 1.1, ease: "easeOut" as const },
      };
    case "celebrate":
      return {
        animate: { y: [0, -24, 0, -12, 0], rotate: [0, -8, 6, 0] },
        transition: { duration: 1.05, repeat: 1, ease: "easeOut" as const },
      };
    default: {
      const _exhaustive: never = motionKind;
      throw new Error(`Movimento inválido: ${String(_exhaustive)}`);
    }
  }
}

function MountainSilhouette() {
  return (
    <path
      data-testid="mountain-fill"
      fill="#111111"
      d="M28 368 L92 332 L168 286 L246 240 L318 196 L392 152 L468 108 L528 68 L556 42 L612 150 L632 368 Z"
    />
  );
}

function ClimberOnTrail({
  x,
  y,
  pose,
}: {
  x: number;
  y: number;
  pose: ReturnType<typeof climbPose>;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g animate={pose.animate} transition={pose.transition}>
        <g transform="translate(-28 -78) scale(0.34)">
          <ClimberShapes />
        </g>
      </motion.g>
    </g>
  );
}

function ClimberOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 260" className={cn("block h-auto w-full", className)} aria-hidden>
      <ClimberShapes />
    </svg>
  );
}

/** Phone-headed climber as one blue silhouette: beanie, jacket, pack, rope, boots. */
function ClimberShapes() {
  return (
    <g fill="#0071e3" data-testid="climber-outline" data-climber-fill="#0071e3">
      <path d="M62 58c0-28 56-28 56 0l8 16H54l8-16z" />
      <rect x="58" y="62" width="64" height="78" rx="12" />
      <path d="M40 132c2-16 16-24 50-24s48 8 50 24v62c0 8-10 14-24 14H64c-14 0-24-6-24-14v-62z" />
      <path d="M40 140c-18 6-28 32-22 58 10 2 18-8 20-22 4-18 8-28 2-36z" />
      <path d="M132 138c14 8 22 28 16 48-8 4-16-4-16-16-2-14 0-24 0-32z" />
      <path d="M124 126h34c8 0 14 8 14 18v46c0 12-8 20-20 20h-28V126z" />
      <circle cx="168" cy="148" r="18" />
      <path d="M150 186c10 14 8 30-2 38 8 2 20-10 20-26s-8-24-18-12z" />
      <path d="M164 196c8 10 6 22-2 28 6 2 14-8 14-18s-6-16-12-10z" />
      <path d="M68 206h22l6 32H64l4-32z" />
      <path d="M96 206h22l4 32H92l4-32z" />
      <path d="M46 232h48c4 10-2 20-16 20H54c-12 0-16-8-8-20z" />
      <path d="M90 232h52c12 12 6 20-6 20H104c-14 0-18-10-14-20z" />
    </g>
  );
}

function SupplyIcon({ id }: { id: SupplyId }) {
  const stroke = {
    fill: "none",
    stroke: "#0071e3",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "mochila":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          <path {...stroke} d="M8 9h8v11H8zM10 9V6h4v3M9 14h6" />
        </svg>
      );
    case "corda":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          <circle {...stroke} cx="12" cy="13" r="4" />
          <path {...stroke} d="M12 3v6M12 17v4" />
        </svg>
      );
    case "casaco":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          <path {...stroke} d="M8 7l4 3 4-3 3 4-3 2v8H8v-8L5 11z" />
        </svg>
      );
    case "comida":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          <path {...stroke} d="M5 11h14v8H5zM8 11V8h8v3" />
        </svg>
      );
    case "lanterna":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
          <path {...stroke} d="M9 13h6l2 7H7zM10 13V8h4v5M12 4v3" />
        </svg>
      );
    default: {
      const _exhaustive: never = id;
      throw new Error(`Equipamento inválido: ${String(_exhaustive)}`);
    }
  }
}

function weatherLayers(kind: WeatherKind): {
  sun: boolean;
  moon: boolean;
  wind: boolean;
  rain: boolean;
  snow: boolean;
} {
  switch (kind) {
    case "clear":
      return { sun: true, moon: false, wind: false, rain: false, snow: false };
    case "calm":
      return { sun: false, moon: true, wind: false, rain: false, snow: false };
    case "wind":
      return { sun: false, moon: false, wind: true, rain: false, snow: false };
    case "rain":
      return { sun: false, moon: false, wind: false, rain: true, snow: false };
    case "snow":
      return { sun: false, moon: false, wind: false, rain: false, snow: true };
    case "storm":
      return { sun: false, moon: false, wind: true, rain: true, snow: true };
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Tempo inválido: ${String(_exhaustive)}`);
    }
  }
}

function WeatherMarks({
  kind,
  density,
  night,
  compact = false,
}: {
  kind: WeatherKind;
  density: number;
  night: boolean;
  compact?: boolean;
}) {
  const stroke = night ? "#f2f2f2" : "#111111";
  const originX = compact ? 36 : 48;
  const originY = compact ? 28 : 36;
  const layers = weatherLayers(kind);
  const showSun = layers.sun;
  const showMoon = layers.moon;
  const showWind = layers.wind;
  const showRain = layers.rain;
  const showSnow = layers.snow;

  return (
    <g data-weather-marks={kind} fill="none" stroke={stroke} strokeLinecap="round">
      {showSun ? <SunArc x={originX} y={originY} /> : null}
      {showMoon ? <MoonArc x={originX} y={originY} /> : null}
      {showWind
        ? Array.from({ length: density * 2 }, (_, index) => (
            <path
              key={`wind-${index}`}
              d={`M${originX + 70} ${originY + index * 14} h36 M${originX + 86} ${originY + 6 + index * 14} h24`}
              strokeWidth="1.6"
            />
          ))
        : null}
      {showRain
        ? Array.from({ length: density * 4 }, (_, index) => (
            <path
              key={`rain-${index}`}
              d={`M${originX + (index % 6) * 14} ${originY + 24 + Math.floor(index / 6) * 16} l-4 12`}
              strokeWidth="1.5"
            />
          ))
        : null}
      {showSnow
        ? Array.from({ length: density * 4 }, (_, index) => (
            <circle
              key={`snow-${index}`}
              cx={originX + 8 + (index % 5) * 16}
              cy={originY + 70 + Math.floor(index / 5) * 14}
              r="1.7"
              fill={stroke}
              stroke="none"
            />
          ))
        : null}
    </g>
  );
}

function SunArc({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeWidth="1.7">
      <path d="M4 18 A14 14 0 0 1 32 18" />
      <path d="M18 0 v6 M4 6 l4 4 M32 6 l-4 4" />
    </g>
  );
}

function MoonArc({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeWidth="1.7">
      <path d="M22 2 A14 14 0 1 0 22 30 A10 10 0 1 1 22 2" />
    </g>
  );
}

function RopePoint({
  x,
  y,
  mark,
  label,
}: {
  x: number;
  y: number;
  mark: RopeMark;
  label: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`} data-rope-mark={mark}>
      <title>{label}</title>
      {mark === "upcoming" ? <UpcomingRing /> : null}
      {mark === "on_time" ? <OnTimeCheck /> : null}
      {mark === "late" ? <LateMark /> : null}
    </g>
  );
}

function UpcomingRing() {
  return <circle r="8" fill="#ffffff" stroke="#0071e3" strokeWidth="2.5" />;
}

function OnTimeCheck() {
  return (
    <g>
      <circle r="8" fill="#16a34a" />
      <path
        d="M-3.2 0.4 L-0.8 2.8 L3.6 -2.2"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function LateMark() {
  return (
    <g>
      <circle r="8" fill="#dc2626" />
      <path
        d="M-3 -3 L3 3 M3 -3 L-3 3"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </g>
  );
}

type WeatherPayload = {
  source?: string;
  kind?: unknown;
};

function isExternalWeather(value: unknown): value is ExternalWeather {
  return value === "clear" || value === "wind" || value === "rain" || value === "snow" || value === "storm";
}

async function readWeather(url: string): Promise<WeatherPayload | null> {
  try {
    const response = await fetch(url);
    if (!response.ok && response.status !== 401) return null;
    return (await response.json()) as WeatherPayload;
  } catch {
    return null;
  }
}
