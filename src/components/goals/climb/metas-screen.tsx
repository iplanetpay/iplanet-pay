"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  GoalState,
  RealWeather,
  TimeOfDayPreset,
  ViewMode,
  WeatherKind,
} from "@/lib/goals/climb/types";
import { MetasClimb } from "./metas-climb";

const CLIMB_DEV = process.env.NODE_ENV === "development";

type DemoPanelType = typeof import("./demo-panel").DemoPanel;
type PresetList = typeof import("@/lib/goals/climb/dev-presets").GOAL_PRESETS;

let DemoPanel: DemoPanelType | null = null;
let devPresets: PresetList | null = null;

if (process.env.NODE_ENV === "development") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const devPanel = require("./demo-panel") as typeof import("./demo-panel");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const presets = require("@/lib/goals/climb/dev-presets") as typeof import("@/lib/goals/climb/dev-presets");
  DemoPanel = devPanel.DemoPanel;
  devPresets = presets.GOAL_PRESETS;
}

const DEV_PRESET_KEYS = new Set(["on_track", "near_late", "late", "p30", "p70", "p100"]);

function readPreset(value: string | null): string | null {
  if (!CLIMB_DEV || !value || value === "live" || !DEV_PRESET_KEYS.has(value)) return null;
  return value;
}

function goalForPreset(key: string | null, live: GoalState | null): GoalState | null {
  if (!devPresets || !key) return live;
  return devPresets.find((preset) => preset.key === key)?.goal ?? live;
}

function readWeather(value: string | null): WeatherKind | "real" {
  if (!CLIMB_DEV || !value || value === "real") return "real";
  const kinds: WeatherKind[] = [
    "clear",
    "partly_cloudy",
    "cloudy",
    "fog",
    "rain",
    "storm",
    "snow",
    "blizzard",
  ];
  return kinds.includes(value as WeatherKind) ? (value as WeatherKind) : "real";
}

function readTime(value: string | null): TimeOfDayPreset {
  if (!CLIMB_DEV || !value) return "real";
  switch (value) {
    case "real":
    case "morning":
    case "afternoon":
    case "dusk":
    case "night":
      return value;
    default:
      return "real";
  }
}

function readView(value: string | null): ViewMode {
  return CLIMB_DEV && value === "closeup" ? "closeup" : "overview";
}

export function MetasScreen({
  goal,
  depositHref,
}: {
  goal: GoalState | null;
  depositHref: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [presetKey, setPresetKey] = useState<string | null>(() => readPreset(params.get("estado")));
  const [weather, setWeather] = useState<WeatherKind | "real">(() => readWeather(params.get("clima")));
  const [time, setTime] = useState<TimeOfDayPreset>(() => readTime(params.get("hora")));
  const [real, setReal] = useState<RealWeather | null>(null);
  const initialView = readView(params.get("visao"));

  const shown = useMemo(() => goalForPreset(presetKey, goal), [goal, presetKey]);

  if (!shown) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Nenhuma meta ainda"
          description="Crie uma meta em uma reserva ativa para ver a subida até o produto."
          action={
            <Link
              href="/app/reservas"
              className="inline-flex h-11 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white"
            >
              Ver reservas
            </Link>
          }
        />
        {DemoPanel ? (
          <div className="metas-climb">
            <DemoPanel
              presetKey={presetKey ?? ""}
              onPreset={setPresetKey}
              weather={weather}
              onWeather={setWeather}
              time={time}
              onTime={setTime}
              real={real}
            />
          </div>
        ) : null}
      </div>
    );
  }

  const deposit =
    depositHref && !presetKey
      ? () => {
          router.push(depositHref);
        }
      : undefined;

  return (
    <MetasClimb
      key={`${shown.id}-${initialView}`}
      goal={shown}
      weatherOverride={CLIMB_DEV ? weather : "real"}
      timeOverride={CLIMB_DEV ? time : "real"}
      initialView={initialView}
      onDeposit={deposit}
      onRealWeather={setReal}
      footer={
        DemoPanel ? (
          <DemoPanel
            presetKey={presetKey ?? "live"}
            onPreset={(key) => setPresetKey(key === "live" ? null : key)}
            weather={weather}
            onWeather={setWeather}
            time={time}
            onTime={setTime}
            real={real}
          />
        ) : null
      }
    />
  );
}
