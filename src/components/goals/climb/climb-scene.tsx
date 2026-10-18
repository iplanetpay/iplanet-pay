import { animate, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Deposit, GoalStatus, ViewMode } from "@/lib/goals/climb/types";
import { clamp } from '@/lib/goals/climb/goal-logic';
import { buildTrail, type SceneSize } from '@/lib/goals/climb/geometry';
import { Climber } from './climber';
import { INK, Mountain } from './mountain';
import { Milestones } from './milestones';

/**
 * Cena SVG: montanha + trilha + marcos + escalador, com uma "câmera" que faz o zoom
 * entre a visão geral e a visão de perto. Posição do escalador e câmera são atualizadas
 * imperativamente a cada frame a partir de dois motion values: progress e zoom.
 * A velocidade real do escalador alimenta a cadência do passo (ver Climber.tsx).
 */
interface Props {
  size: SceneSize;
  ppu: number;
  percent: number;
  status: GoalStatus;
  deposits: Deposit[];
  mountainFill: string;
  view: ViewMode;
  onToggleView: () => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

const FIG_H = 44;
const reduce = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ClimbScene({ size, ppu, percent, status, deposits, mountainFill, view, onToggleView, selected, onSelect }: Props) {
  const { W, H } = size;
  const trail = useMemo(() => buildTrail(size), [size]);
  const progress = useMotionValue(0);
  const zoom = useMotionValue(view === 'closeup' ? 1 : 0);
  const speedRef = useRef(0);
  const lastRef = useRef({ t: 0, p: 0 });

  const camRef = useRef<SVGGElement>(null);
  const climberRef = useRef<SVGGElement>(null);
  const ledgeRef = useRef<SVGLineElement>(null);
  const pinRef = useRef<SVGGElement>(null);
  const labelsRef = useRef<SVGGElement>(null);
  const walkedRef = useRef<SVGPathElement>(null);
  const done = status === 'done';
  const [arrived, setArrived] = useState(false);

  const sOv = 46 / (FIG_H * ppu);
  const sCl = sOv * 0.85;
  const Zc = 180 / (FIG_H * ppu * sCl);

  const update = useCallback(() => {
    const z = zoom.get();
    const t = clamp(progress.get(), 0, 1);
    const p = trail.pointAt(t);
    const dir = done || p.tx >= 0 ? 1 : -1;
    const s = sOv + (sCl - sOv) * z;

    // velocidade ao longo da trilha (só para frente) → cadência dos passos
    const now = performance.now();
    const L = lastRef.current;
    const dt = (now - L.t) / 1000;
    if (dt > 0 && dt < 0.2 && L.t > 0) {
      const v = Math.max(0, (t - L.p) * trail.length) / dt;
      speedRef.current += (v - speedRef.current) * 0.35;
    } else speedRef.current = 0;
    L.t = now;
    L.p = t;

    const ZcE = done ? Zc * 0.72 : Zc;
    const cam = 1 + (ZcE - 1) * z;
    const halfW = W / (2 * ZcE);
    const halfH = H / (2 * ZcE);
    const cxT = clamp(p.x, halfW, W - halfW);
    const cyT = clamp(p.y - (done ? 36 : 20) * s, halfH, H - halfH);
    const cx = W / 2 + (cxT - W / 2) * z;
    const cy = H / 2 + (cyT - H / 2) * z;
    camRef.current?.style.setProperty('--ms', String(1 / Math.sqrt(cam)));
    camRef.current?.setAttribute('transform', `translate(${W / 2} ${H / 2}) scale(${cam}) translate(${-cx} ${-cy})`);

    climberRef.current?.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${dir * s} ${s})`);

    // apoio sob os pés, acompanhando a inclinação da trilha
    let a = (Math.atan2(p.ty, p.tx) * 180) / Math.PI;
    if (a > 90) a -= 180;
    if (a < -90) a += 180;
    const led = ledgeRef.current;
    if (led) {
      led.setAttribute('transform', `translate(${p.x} ${p.y + 0.4 * s}) rotate(${a}) scale(${s})`);
    }
    walkedRef.current?.setAttribute('d', trail.pathUpTo(t));

    const pin = pinRef.current;
    if (pin) {
      pin.setAttribute('transform', `translate(${p.x} ${p.y - FIG_H * s - 8 / ppu}) scale(${1 / ppu})`);
      pin.style.opacity = done ? '0' : String(clamp(1 - z * 2.2, 0, 1));
    }
    if (labelsRef.current) labelsRef.current.style.opacity = String(clamp(1 - z * 2.5, 0, 1));
  }, [trail, W, H, sOv, sCl, Zc, ppu, done, zoom, progress]);

  useMotionValueEvent(progress, 'change', update);
  useMotionValueEvent(zoom, 'change', update);
  useLayoutEffect(update, [update]);

  // sobe até o percentual: ritmo constante e parada suave (mais lento quando atrasada)
  useEffect(() => {
    const target = percent / 100;
    const cur = progress.get();
    if (reduce() || target <= cur) {
      progress.set(target);
      setArrived(true);
      return;
    }
    setArrived(false);
    const dist = target - cur;
    const base = status === 'late' ? 5.2 : status === 'near_late' ? 4.2 : 3.2;
    const c = animate(progress, target, {
      duration: Math.min(6.5, 1 + dist * base * 1.9),
      ease: status === 'late' ? [0.2, 0.6, 0.35, 1] : [0.35, 0.1, 0.25, 1],
      onComplete: () => setArrived(true),
    });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percent, status]);

  // zoom entre as visões
  const first = useRef(true);
  useEffect(() => {
    const target = view === 'closeup' ? 1 : 0;
    if (first.current || reduce()) {
      first.current = false;
      zoom.set(target);
      return;
    }
    const c = animate(zoom, target, { duration: 1.3, ease: [0.65, 0, 0.35, 1] });
    return () => c.stop();
  }, [view, zoom]);

  const bow = status === 'late' ? 0.9 : status === 'near_late' ? 0.35 : 0;
  const unit = sOv;
  const summit = trail.pointAt(1);
  const start = trail.pointAt(0);
  const fs = 11 / ppu;

  return (
    <svg className="scene-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Montanha com o progresso da meta">
      <defs>
        <linearGradient id="mtnShade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#8aa0c0" stopOpacity="0.16" />
        </linearGradient>
        <radialGradient id="doneGlow">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#ffe9a8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g ref={camRef}>
        <Mountain size={size} fill={mountainFill} />

        {/* trecho percorrido */}
        <path ref={walkedRef} fill="none" stroke="#0071e3" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

        <Milestones deposits={deposits} trail={trail} r={4.8 / ppu} selected={selected} onSelect={onSelect} />

        <g ref={labelsRef} style={{ pointerEvents: 'none' }}>
          <text x={start.x} y={start.y + 18 / ppu} textAnchor="middle" fontSize={fs} fontWeight="500" fill="#6e6e73" className="svg-label">
            Início
          </text>
          <text x={summit.x + 30 * unit} y={summit.y - 62 * unit} textAnchor="start" fontSize={fs} fontWeight="600" fill="#6e6e73" className="svg-label">
            Topo
          </text>
        </g>

        {/* brilho suave ao concluir */}
        {done && arrived && (
          <circle cx={summit.x} cy={summit.y - 30 * unit} r={70 * unit} fill="url(#doneGlow)" className="done-glow" style={{ pointerEvents: 'none' }} />
        )}

        <line ref={ledgeRef} x1="-12" x2="12" y1="0" y2="0" stroke={INK} strokeWidth="1.4" strokeLinecap="round" opacity="0.35" vectorEffect="non-scaling-stroke" />

        <g ref={climberRef} onClick={onToggleView} style={{ cursor: 'pointer' }} role="button" aria-label="Alternar visão">
          <circle cx="0" cy="-22" r="30" fill="transparent" />
          <Climber speedRef={speedRef} bow={bow} celebrate={done && arrived} />
        </g>

        <g ref={pinRef} style={{ pointerEvents: 'none' }}>
          <rect x="-24" y="-23" width="48" height="22" rx="11" fill="#ffffff" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
          <text x="0" y="-7.6" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#0071e3">
            {Math.round(percent)}%
          </text>
        </g>
      </g>
    </svg>
  );
}
