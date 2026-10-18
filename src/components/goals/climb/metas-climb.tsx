"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { EffectiveWeather, MetasClimbProps, RealWeather, ViewMode, WeatherKind } from "@/lib/goals/climb/types";
import { brl, formatDate, percentOf } from "@/lib/goals/climb/goal-logic";
import { LANDSCAPE, PORTRAIT } from "@/lib/goals/climb/geometry";
import { computeSky, presetHour } from "@/lib/goals/climb/sky";
import { effectiveWeather, fallbackWeather, getCoords, openMeteoProvider } from "@/lib/goals/climb/weather";
import { CelebrationEffect } from "./celebration-effect";
import { ClimbScene } from "./climb-scene";
import { StatusPill } from "./status-pill";
import { GoalStats } from "./goal-stats";
import { SkyCycle } from "./sky-cycle";
import { ViewToggle } from "./view-toggle";
import { Weather } from "./weather-layer";
import { WeatherChip } from "./weather-chip";

/** Clima final quando forçado pelo painel de testes. */
function forcedWeather(kind: WeatherKind, temp: number): EffectiveWeather {
  const m: Record<WeatherKind, [number, number]> = {
    clear: [0, 0.15],
    partly_cloudy: [0, 0.2],
    cloudy: [0, 0.35],
    fog: [0, 0.2],
    rain: [0.8, 0.5],
    storm: [1, 0.9],
    snow: [0.7, 0.4],
    blizzard: [1, 0.95],
  };
  return { kind, intensity: m[kind][0], wind: m[kind][1], temperatureC: temp };
}

const STATUS_PT: Record<string, string> = {
  paid_on_time: 'pago no prazo',
  paid_late: 'pago fora do prazo',
  pending: 'a vencer',
  missed: 'em atraso',
};

/**
 * <MetasClimb /> — componente de integração da página Metas.
 * Basta passar o `goal` vindo do backend; clima e horário são resolvidos aqui dentro.
 */
export function MetasClimb({
  goal,
  weatherProvider = openMeteoProvider,
  coords,
  weatherOverride = 'real',
  timeOverride = 'real',
  initialView = 'overview',
  onViewChange,
  onDeposit,
  onRealWeather,
  footer,
}: MetasClimbProps & { footer?: ReactNode }) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [selected, setSelected] = useState<string | null>(null);
  const [real, setReal] = useState<RealWeather>(() => fallbackWeather('carregando'));
  const sceneRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  const changeView = (v: ViewMode) => {
    setView(v);
    onViewChange?.(v);
  };

  // clima real (geolocalização → provedor → fallback)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = coords ?? (await getCoords());
        const w = await weatherProvider.getCurrent(c);
        if (alive) {
          setReal(w);
          onRealWeather?.(w);
        }
      } catch {
        const fb = fallbackWeather('sem rede');
        if (alive) {
          setReal(fb);
          onRealWeather?.(fb);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherProvider, coords?.lat, coords?.lon]);

  // tamanho do contêiner → formato retrato/paisagem + px por unidade
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const size = width < 620 ? PORTRAIT : LANDSCAPE;
  const ppu = Math.max(0.2, width / size.W);

  const percent = percentOf(goal);
  const hour = presetHour(timeOverride, real.localHour, real.sunset);
  const eff = useMemo(
    () => (weatherOverride === 'real' ? effectiveWeather(real, goal.status) : forcedWeather(weatherOverride, real.temperatureC)),
    [real, goal.status, weatherOverride],
  );
  const sky = useMemo(() => computeSky(hour, real.sunrise, real.sunset, eff.kind), [hour, real.sunrise, real.sunset, eff.kind]);
  const worsened = goal.status === 'near_late' || goal.status === 'late';
  const sel = goal.deposits.find((d) => d.id === selected);
  const idx = sel ? goal.deposits.indexOf(sel) : -1;

  // deslizar na horizontal troca a visão (toque)
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent) => {
    swipe.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45) changeView(dx < 0 ? 'closeup' : 'overview');
  };

  return (
    <div className="metas-climb" data-testid="metas-trail" data-status={goal.status} data-view={view}>
      <div className="scene-col">
        <div
          ref={sceneRef}
          className="scene"
          data-view={view}
          data-night={sky.isNight ? '1' : '0'}
          style={{ aspectRatio: `${size.W} / ${size.H}` }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={() => setSelected(null)}
        >
          <SkyCycle sky={sky} />
          <Weather weather={eff} layer="back" light={sky.light} />
          <ClimbScene
            size={size}
            ppu={ppu}
            percent={percent}
            status={goal.status}
            deposits={goal.deposits}
            prize={goal.product.kind}
            mountainFill={sky.mountainFill}
            view={view}
            onToggleView={() => changeView(view === 'overview' ? 'closeup' : 'overview')}
            selected={selected}
            onSelect={setSelected}
          />
          <Weather weather={eff} layer="front" light={sky.light} />
          <CelebrationEffect active={goal.status === 'done'} />

          {/* HUD */}
          <div className="hud hud-top">
            <StatusPill goal={goal} />
            <ViewToggle view={view} onChange={changeView} />
          </div>
          <AnimatePresence>
            {goal.status === 'done' && (
              <motion.div
                className="trophy-banner glass"
                initial={{ opacity: 0, y: -14, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 18 }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6" fill="none" stroke="#b25e00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Meta conquistada
              </motion.div>
            )}
          </AnimatePresence>
          <div className="hud hud-bottom">
            <WeatherChip kind={eff.kind} temp={eff.temperatureC} night={sky.isNight} worsened={worsened} />
            <AnimatePresence mode="wait">
              {sel ? (
                <motion.div key={sel.id} className="pill glass tip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <b>Aporte {idx + 1}</b> · {formatDate(sel.dueDate)} · {brl(sel.amount)} · {STATUS_PT[sel.status]}
                </motion.div>
              ) : (
                <motion.div key="left" className="pill glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {goal.status === 'done' ? 'Prêmio conquistado' : <>Faltam <b>{brl(Math.max(0, goal.targetAmount - goal.savedAmount))}</b></>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <aside className="side-col">
        <GoalStats goal={goal} onDeposit={onDeposit} />
      </aside>
      {footer}
    </div>
  );
}
