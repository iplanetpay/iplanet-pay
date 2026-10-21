"use client";

import { animate, useMotionValue, useMotionValueEvent } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Deposit, GoalStatus, ViewMode } from "@/lib/goals/climb/types";
import { clamp } from "@/lib/goals/climb/goal-logic";
import {
  buildRoute,
  planetRadius,
  rocketProfile,
  sampleRocket,
  seeded,
  type RouteSize,
} from "@/lib/goals/climb/space-journey";
import { IPlanetPlanet } from "./iplanet-planet";
import { Milestones } from "./milestones";

/**
 * Cena SVG da viagem: Terra → rota curva → planeta iPlanet.
 * O foguete avança até o percentual pago em ritmo constante e para suave;
 * a chama acompanha a velocidade. Uma "câmera" alterna Visão geral / De perto.
 */
interface Props {
  size: RouteSize;
  ppu: number;
  percent: number;
  status: GoalStatus;
  deposits: Deposit[];
  view: ViewMode;
  onToggleView: () => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onLanded?: () => void;
}

const BLUE = "#3b8bff";
const reduce = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function stars(seed: number, n: number, W: number, H: number) {
  const rnd = seeded(seed);
  return Array.from({ length: n }, () => ({ x: rnd() * W * 1.3 - W * 0.15, y: rnd() * H * 1.3 - H * 0.15, r: 0.4 + rnd() * 1.2, o: 0.35 + rnd() * 0.65, d: rnd() * 4 }));
}

export function RocketScene({ size, ppu, percent, status, deposits, view, onToggleView, selected, onSelect, onLanded }: Props) {
  const { W, H } = size;
  const route = useMemo(() => buildRoute(size), [size]);
  const R = planetRadius(size);
  const profile = rocketProfile(status);
  const done = status === "done";
  const zoom = useMotionValue(view === "closeup" ? 1 : 0);
  const [landed, setLanded] = useState(false);

  const camRef = useRef<SVGGElement>(null);
  const rocketRef = useRef<SVGGElement>(null);
  const flameRef = useRef<SVGGElement>(null);
  const traveledRef = useRef<SVGPathElement>(null);
  const pinRef = useRef<SVGGElement>(null);
  const labelsRef = useRef<SVGGElement>(null);
  const layers = useRef<Array<SVGGElement | null>>([]);
  const state = useRef({ progress: 0, flame: 0, t0: 0, time: 0 });

  const starLayers = useMemo(() => [stars(7, 70, W, H), stars(19, 40, W, H), stars(31, 18, W, H)], [W, H]);

  const render = useCallback(() => {
    const { progress, flame, time } = state.current;
    const z = zoom.get();
    let pose = route.pointAt(progress);
    let angle = (pose.angle * 180) / Math.PI;
    // pouso: nos últimos 10% de uma meta concluída o foguete encosta no topo do planeta
    if (done && progress > 0.9) {
      const u = clamp((progress - 0.9) / 0.1, 0, 1);
      const e = u * u * (3 - 2 * u);
      const land = { x: route.planet.x, y: route.planet.y - R * 1.02 };
      pose = { x: pose.x + (land.x - pose.x) * e, y: pose.y + (land.y - pose.y) * e, angle: pose.angle };
      angle = angle + (-90 - angle) * e;
    }
    const wob = profile.wobble * Math.sin(time * 2.2) * 6 * flame;
    const shake = profile.turbulence * flame;
    const sx = shake ? Math.sin(time * 47) * 1.4 * shake : 0;
    const sy = shake ? Math.cos(time * 53) * 1.4 * shake : 0;
    const s = 1 / Math.sqrt(1 + z * 1.4);
    rocketRef.current?.setAttribute("transform", `translate(${pose.x + sx} ${pose.y + sy}) rotate(${angle + 90 + wob}) scale(${s})`);
    flameRef.current?.setAttribute("transform", `scale(${0.6 + flame * 0.8 + Math.sin(time * 30) * 0.06 * (flame > 0.05 ? 1 : 0)} ${0.25 + flame * 1.3 + Math.sin(time * 37) * 0.12 * flame})`);
    if (flameRef.current) flameRef.current.style.opacity = String(done && progress >= 0.999 ? 0 : 0.35 + flame * 0.65);
    traveledRef.current?.setAttribute("d", route.pathTo(Math.min(progress, 1)));

    const cam = 1 + 1.4 * z;
    const halfW = W / (2 * cam);
    const halfH = H / (2 * cam);
    const cx = W / 2 + (clamp(pose.x, halfW, W - halfW) - W / 2) * z;
    const cy = H / 2 + (clamp(pose.y, halfH, H - halfH) - H / 2) * z;
    camRef.current?.style.setProperty("--ms", String(1 / Math.sqrt(cam)));
    camRef.current?.setAttribute("transform", `translate(${W / 2} ${H / 2}) scale(${cam}) translate(${-cx} ${-cy})`);
    // paralaxe: camadas mais próximas se deslocam mais com o foguete e a câmera
    layers.current.forEach((g, i) => {
      const f = (i + 1) * 0.04;
      g?.setAttribute("transform", `translate(${-(pose.x - W / 2) * f * (1 + z)} ${-(pose.y - H / 2) * f * (1 + z)})`);
    });
    const pin = pinRef.current;
    if (pin) {
      pin.setAttribute("transform", `translate(${pose.x} ${pose.y - 30 * s}) scale(${1 / ppu / cam})`);
      pin.style.opacity = done ? "0" : String(clamp(1 - z * 2.2, 0, 1));
    }
    if (labelsRef.current) labelsRef.current.style.opacity = String(clamp(1 - z * 2.5, 0, 1));
  }, [route, zoom, W, H, R, ppu, done, profile]);

  const renderRef = useRef(render);
  renderRef.current = render;
  useMotionValueEvent(zoom, "change", () => renderRef.current());
  useLayoutEffect(render, [render]);

  // viagem até o percentual (rAF): cruzeiro constante + parada suave
  useEffect(() => {
    const target = clamp(percent / 100, 0, 1);
    if (reduce()) {
      state.current = { progress: target, flame: 0, t0: 0, time: 0 };
      renderRef.current();
      setLanded(true);
      onLanded?.();
      return;
    }
    setLanded(false);
    let raf = 0;
    let fired = false;
    const start = performance.now();
    const frame = (now: number) => {
      const elapsed = (now - start) / 1000;
      const smp = sampleRocket(profile, target, elapsed);
      state.current.progress = smp.progress;
      state.current.flame = Math.max(smp.flame, 0.12);
      state.current.time = elapsed;
      renderRef.current();
      if (!fired && smp.progress >= target && smp.speed === 0) {
        fired = true;
        setLanded(true);
        onLanded?.();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percent, status]);

  // zoom entre as visões
  const first = useRef(true);
  useEffect(() => {
    const target = view === "closeup" ? 1 : 0;
    if (first.current || reduce()) {
      first.current = false;
      zoom.set(target);
      return;
    }
    const c = animate(zoom, target, { duration: 1.2, ease: [0.65, 0, 0.35, 1] });
    return () => c.stop();
  }, [view, zoom]);

  const fs = 11 / ppu;
  const earthR = R * 0.72;

  return (
    <svg className="scene-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Viagem até o planeta iPlanet: ${Math.round(percent)}% da meta`}>
      <defs>
        <radialGradient id="earthGrad" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#7cc4ff" />
          <stop offset="0.55" stopColor="#1f6fd1" />
          <stop offset="1" stopColor="#0b2a66" />
        </radialGradient>
        <radialGradient id="earthAtmo">
          <stop offset="0.7" stopColor="#5fb2ff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#5fb2ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="flameGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.4" stopColor="#ffb238" />
          <stop offset="1" stopColor="#ff4d6d" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hullGrad" x1="0" x2="1">
          <stop offset="0" stopColor="#dfe6f5" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#b8c4dc" />
        </linearGradient>
        <linearGradient id="phoneGrad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#3b8bff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {starLayers.map((layer, i) => (
        <g key={i} ref={(el) => { layers.current[i] = el; }} className={`stars stars-${i}`}>
          {layer.map((st, j) => (
            <circle key={j} cx={st.x} cy={st.y} r={st.r * (1 + i * 0.35)} fill="#fff" opacity={st.o} style={{ animationDelay: `${st.d}s` }} />
          ))}
        </g>
      ))}

      <g ref={camRef}>
        {/* Terra */}
        <g transform={`translate(${route.earth.x} ${route.earth.y + earthR * 0.55})`}>
          <circle r={earthR * 1.35} fill="url(#earthAtmo)" />
          <circle r={earthR} fill="url(#earthGrad)" />
          <path d={`M${-earthR * 0.6},${-earthR * 0.2} q${earthR * 0.3},${-earthR * 0.4} ${earthR * 0.6},${-earthR * 0.1} t${earthR * 0.4},${earthR * 0.3} q${-earthR * 0.3},${earthR * 0.35} ${-earthR * 0.7},${earthR * 0.15}z`} fill="#3ccf91" opacity="0.75" />
        </g>

        {/* rota: restante tracejado, percorrido em azul */}
        <path d={route.pathTo(1)} fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="1.6" strokeDasharray="2 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path ref={traveledRef} fill="none" stroke={BLUE} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 6px rgba(59,139,255,0.8))" }} />

        <g transform={`translate(${route.planet.x} ${route.planet.y})`}>
          <IPlanetPlanet r={R} glow={done && landed ? 1 : 0} />
        </g>

        <Milestones deposits={deposits} trail={route} r={5.2 / ppu} selected={selected} onSelect={onSelect} />

        <g ref={labelsRef} style={{ pointerEvents: "none" }}>
          <text x={route.earth.x} y={route.earth.y + earthR * 0.55 + earthR + 16 / ppu} textAnchor="middle" fontSize={fs} fontWeight="600" fill="rgba(255,255,255,0.7)" className="svg-label">
            Terra
          </text>
          <text x={route.planet.x} y={route.planet.y + R * 1.55 + 14 / ppu} textAnchor="middle" fontSize={fs} fontWeight="600" fill="rgba(255,255,255,0.7)" className="svg-label">
            iPlanet
          </text>
        </g>

        {done && landed ? <Prize x={route.planet.x + R * 1.25} y={route.planet.y - R * 0.9} s={R / 60} /> : null}

        <g ref={rocketRef} onClick={(e) => { e.stopPropagation(); onToggleView(); }} style={{ cursor: "pointer" }} role="button" aria-label="Alternar visão">
          <circle r="30" fill="transparent" />
          <g ref={flameRef} style={{ transformOrigin: "0 14px" }}>
            <path d="M-6,14 Q0,44 6,14 Z" fill="url(#flameGrad)" transform="translate(0 0)" />
            <path d="M-3,14 Q0,30 3,14 Z" fill="#fff" opacity="0.85" />
          </g>
          <path d="M-7,6 L-14,16 L-7,14 Z M7,6 L14,16 L7,14 Z" fill="#ff5a7a" />
          <path d="M0,-22 C9,-12 9,4 7,14 L-7,14 C-9,4 -9,-12 0,-22 Z" fill="url(#hullGrad)" stroke="#1B2350" strokeWidth="1.2" />
          <circle cy="-6" r="3.6" fill="#3b8bff" stroke="#1B2350" strokeWidth="1.1" />
          <path d="M-2.5,14 L2.5,14 L1.5,18 L-1.5,18 Z" fill="#1B2350" />
        </g>

        <g ref={pinRef} style={{ pointerEvents: "none" }}>
          <rect x="-24" y="-23" width="48" height="22" rx="11" fill="rgba(255,255,255,0.95)" />
          <text x="0" y="-7.6" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#0b3a8c">
            {Math.round(percent)}%
          </text>
        </g>
      </g>
    </svg>
  );
}

/** Prêmio: o smartphone aparece ao lado do planeta com brilho. */
function Prize({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className="prize" aria-hidden>
      <circle r="46" fill="#ffffff" opacity="0.18" className="planet-glow" />
      <g className="prize-in">
        <rect x="-15" y="-28" width="30" height="56" rx="7" fill="#0d1230" stroke="#e8eeff" strokeWidth="1.6" />
        <rect x="-12" y="-24" width="24" height="48" rx="4" fill="url(#phoneGrad)" />
        <rect x="-5" y="-22" width="10" height="3" rx="1.5" fill="#0d1230" />
        <path d="M-5,0 L-1.5,4 L6,-5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}
