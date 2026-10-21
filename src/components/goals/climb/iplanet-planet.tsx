"use client";

import { useEffect, useRef } from "react";

export const PLANET_NAVY = "#1B2350";

const LONGITUDES = 12;
const LATITUDES = [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75];

/**
 * Logo da iPlanet em vetor: globo branco com grade azul-marinho que gira devagar,
 * anel inclinado (estilo Saturno) passando por trás e pela frente, e a barra do "I".
 * Desenhado em torno de (0,0) com raio `r`.
 */
export function IPlanetPlanet({ r, spin = true, glow = 0 }: { r: number; spin?: boolean; glow?: number }) {
  const lonRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const g = lonRef.current;
    if (!g) return;
    const draw = (phase: number) => {
      const nodes = g.children;
      for (let i = 0; i < nodes.length; i++) {
        const a = phase + (i * Math.PI) / LONGITUDES;
        (nodes[i] as SVGEllipseElement).setAttribute("rx", String(Math.abs(Math.cos(a)) * r));
      }
    };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!spin || reduce) {
      draw(0.35);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      draw(0.35 + ((now - start) / 1000) * 0.18);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [r, spin]);

  const sw = Math.max(0.6, r * 0.022);
  const ringRx = r * 1.62;
  const ringRy = r * 0.36;
  const ringW = r * 0.13;
  const id = `ipl-${Math.round(r * 10)}`;

  const ring = (half: "back" | "front") => (
    <g clipPath={`url(#${id}-${half})`}>
      <ellipse rx={ringRx} ry={ringRy} fill="none" stroke={PLANET_NAVY} strokeWidth={ringW} />
    </g>
  );

  return (
    <g className="iplanet-planet" aria-hidden>
      <defs>
        <clipPath id={`${id}-globe`}>
          <circle r={r} />
        </clipPath>
        {/* metade de trás do anel (acima do equador) e da frente (abaixo) */}
        <clipPath id={`${id}-back`}>
          <rect x={-ringRx * 1.2} y={-ringRy * 2} width={ringRx * 2.4} height={ringRy * 2} />
        </clipPath>
        <clipPath id={`${id}-front`}>
          <rect x={-ringRx * 1.2} y={0} width={ringRx * 2.4} height={ringRy * 2} />
        </clipPath>
        <radialGradient id={`${id}-shade`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef2fb" />
          <stop offset="1" stopColor="#c9d3ea" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0.55" stopColor="#8fb6ff" stopOpacity={0.35 + glow * 0.4} />
          <stop offset="1" stopColor="#8fb6ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r={r * (1.7 + glow * 0.5)} fill={`url(#${id}-halo)`} className={glow ? "planet-glow" : undefined} />
      <g transform="rotate(-12)">
        {ring("back")}
        <g transform="rotate(22)">
          <circle r={r} fill={`url(#${id}-shade)`} />
          <g clipPath={`url(#${id}-globe)`} fill="none" stroke={PLANET_NAVY} strokeWidth={sw}>
            {LATITUDES.map((lat) => {
              const y = Math.sin((lat * Math.PI) / 180) * r;
              const w = Math.cos((lat * Math.PI) / 180) * r;
              return <line key={lat} x1={-w} x2={w} y1={y} y2={y} />;
            })}
            <g ref={lonRef}>
              {Array.from({ length: LONGITUDES }, (_, i) => (
                <ellipse key={i} rx={r} ry={r} />
              ))}
            </g>
            <circle cx={0} cy={-r * 0.93} r={r * 0.16} fill={PLANET_NAVY} stroke="none" />
          </g>
          <circle r={r} fill="none" stroke={PLANET_NAVY} strokeWidth={sw * 1.6} />
        </g>
        {ring("front")}
        {/* barra do "I", inclinada */}
        <g transform="rotate(16)">
          <rect x={-r * 0.12} y={-r * 0.62} width={r * 0.24} height={r * 1.24} rx={r * 0.03} fill={PLANET_NAVY} stroke="#fff" strokeWidth={sw * 1.4} />
        </g>
      </g>
    </g>
  );
}
