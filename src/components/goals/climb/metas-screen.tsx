"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ContributionCalendar } from "@/components/reservations/contribution-calendar";
import { EmptyState } from "@/components/ui/empty-state";
import { selectClimbGoal, type ClimbGoalEntry } from "@/lib/goals/climb/goal-cards";
import type { GoalCalendarData } from "@/lib/goals/goal-calendar";
import type {
  GoalState,
  RealWeather,
  TimeOfDayPreset,
  ViewMode,
  WeatherKind,
} from "@/lib/goals/climb/types";
import { GoalGrid } from "./goal-grid";
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

export function MetasScreen({ entries }: { entries: ClimbGoalEntry[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const metaId = params.get("meta");
  const selected = selectClimbGoal(entries, metaId);
  const [presetKey, setPresetKey] = useState<string | null>(() => readPreset(params.get("estado")));
  const [trackedMeta, setTrackedMeta] = useState(metaId);
  const [weather, setWeather] = useState<WeatherKind | "real">(() => readWeather(params.get("clima")));
  const [time, setTime] = useState<TimeOfDayPreset>(() => readTime(params.get("hora")));
  const [real, setReal] = useState<RealWeather | null>(null);
  const initialView = readView(params.get("visao"));

  if (trackedMeta !== metaId) {
    setTrackedMeta(metaId);
    setPresetKey(readPreset(params.get("estado")));
  }

  const live = selected?.goal ?? null;
  const shown = useMemo(() => goalForPreset(presetKey, live), [live, presetKey]);
  const preview = entries.length === 0 ? shown : null;

  if (!selected) {
    if (preview) {
      return (
        <ClimbView
          goal={preview}
          depositHref={null}
          presetKey={presetKey}
          setPresetKey={setPresetKey}
          weather={weather}
          setWeather={setWeather}
          time={time}
          setTime={setTime}
          setReal={setReal}
          initialView={initialView}
          router={router}
          real={real}
          onBack={() => setPresetKey(null)}
        />
      );
    }
    if (entries.length === 0) {
      return (
        <div className="space-y-6">
          <EmptyState
            title="Nenhuma meta ainda"
            description="Simule os aportes e crie uma meta para acompanhar a subida."
            action={
              <Link
                href="/app/simulador"
                className="inline-flex h-11 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white"
              >
                Abrir simulador
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
    return <GoalGrid entries={entries} />;
  }

  return (
    <ClimbView
      goal={shown ?? selected.goal}
      depositHref={selected.depositHref}
      calendar={presetKey ? null : selected.calendar}
      today={selected.today}
      presetKey={presetKey}
      setPresetKey={setPresetKey}
      weather={weather}
      setWeather={setWeather}
      time={time}
      setTime={setTime}
      setReal={setReal}
      initialView={initialView}
      router={router}
      real={real}
    />
  );
}

function ClimbView({
  goal,
  depositHref,
  calendar = null,
  today = "",
  presetKey,
  setPresetKey,
  weather,
  setWeather,
  time,
  setTime,
  setReal,
  initialView,
  router,
  real,
  onBack,
}: {
  goal: GoalState;
  depositHref: string | null;
  calendar?: GoalCalendarData | null;
  today?: string;
  presetKey: string | null;
  setPresetKey: (key: string | null) => void;
  weather: WeatherKind | "real";
  setWeather: (value: WeatherKind | "real") => void;
  time: TimeOfDayPreset;
  setTime: (value: TimeOfDayPreset) => void;
  real: RealWeather | null;
  setReal: (value: RealWeather | null) => void;
  initialView: ViewMode;
  router: ReturnType<typeof useRouter>;
  onBack?: () => void;
}) {
  const deposit =
    depositHref && !presetKey
      ? () => {
          router.push(depositHref);
        }
      : undefined;

  return (
    <div className="space-y-4">
      {onBack ? (
        <button type="button" onClick={onBack} className="metas-back">
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
          <span>Voltar</span>
        </button>
      ) : null}
      <MetasClimb
        key={`${goal.id}-${initialView}`}
        goal={goal}
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
      {calendar ? <ContributionCalendar {...calendar} paged today={today} /> : null}
    </div>
  );
}
