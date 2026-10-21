"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { MetasClimbProps, ViewMode } from "@/lib/goals/climb/types";
import { brl, formatDate, percentOf } from "@/lib/goals/climb/goal-logic";
import {
  SPACE_LANDSCAPE,
  SPACE_PORTRAIT,
  nebulaTint,
  presetHour,
} from "@/lib/goals/climb/space-journey";
import { CelebrationEffect } from "./celebration-effect";
import { RocketScene } from "./rocket-scene";
import { StatusPill } from "./status-pill";
import { GoalStats } from "./goal-stats";
import { ViewToggle } from "./view-toggle";

const STATUS_PT: Record<string, string> = {
  paid_on_time: "pago no prazo",
  paid_late: "pago fora do prazo",
  pending: "a vencer",
  missed: "em atraso",
};

/**
 * <MetasClimb /> — "Viagem até o planeta" da página Metas.
 * Basta passar o `goal` vindo do backend; espaço e horário são resolvidos aqui.
 */
export function MetasClimb({
  goal,
  timeOverride = "real",
  initialView = "overview",
  onViewChange,
  onDeposit,
  footer,
}: MetasClimbProps & { footer?: ReactNode }) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [selected, setSelected] = useState<string | null>(null);
  const [landed, setLanded] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hour, setHour] = useState(12);

  useEffect(() => {
    setHour(presetHour(timeOverride));
  }, [timeOverride]);

  const changeView = (v: ViewMode) => {
    setView(v);
    onViewChange?.(v);
  };

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const size = width < 620 ? SPACE_PORTRAIT : SPACE_LANDSCAPE;
  const ppu = Math.max(0.2, width / size.W);

  const percent = percentOf(goal);
  const nebula = nebulaTint(hour);
  const sel = goal.deposits.find((d) => d.id === selected);
  const idx = sel ? goal.deposits.indexOf(sel) : -1;
  const done = goal.status === "done";

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
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45) changeView(dx < 0 ? "closeup" : "overview");
  };

  return (
    <div className="metas-climb" data-testid="metas-trail" data-status={goal.status} data-view={view}>
      <div className="scene-col">
        <div
          ref={sceneRef}
          className="scene space"
          data-view={view}
          data-period={nebula.period}
          style={{
            aspectRatio: `${size.W} / ${size.H}`,
            background: `radial-gradient(120% 80% at 75% 20%, ${nebula.glow.replace("rgb", "rgba").replace(")", ",0.35)")} 0%, transparent 55%), radial-gradient(90% 70% at 10% 95%, rgba(59,139,255,0.25) 0%, transparent 60%), linear-gradient(180deg, ${nebula.top}, ${nebula.bottom})`,
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={() => setSelected(null)}
        >
          <RocketScene
            size={size}
            ppu={ppu}
            percent={percent}
            status={goal.status}
            deposits={goal.deposits}
            view={view}
            onToggleView={() => changeView(view === "overview" ? "closeup" : "overview")}
            selected={selected}
            onSelect={setSelected}
            onLanded={() => setLanded(true)}
          />
          <CelebrationEffect active={done && landed} />

          <div className="hud hud-top">
            <StatusPill goal={goal} />
            <ViewToggle view={view} onChange={changeView} />
          </div>
          <AnimatePresence>
            {done && landed && (
              <motion.div
                className="trophy-banner glass"
                initial={{ opacity: 0, y: -14, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 18 }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6" fill="none" stroke="#b25e00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Meta conquistada
              </motion.div>
            )}
          </AnimatePresence>
          <div className="hud hud-bottom">
            <AnimatePresence mode="wait">
              {sel ? (
                <motion.div key={sel.id} className="pill glass tip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <b>Aporte {idx + 1}</b> · {formatDate(sel.dueDate)} · {brl(sel.amount)} · {STATUS_PT[sel.status]}
                </motion.div>
              ) : (
                <motion.div key="left" className="pill glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {done ? "Prêmio conquistado" : <>Faltam <b>{brl(Math.max(0, goal.targetAmount - goal.savedAmount))}</b></>}
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
