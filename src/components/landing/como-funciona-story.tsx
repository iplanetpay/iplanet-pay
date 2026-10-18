"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ChevronDown, QrCode, Store, Truck } from "lucide-react";
import { CHOOSE_TILES } from "@/lib/landing/choose-tiles";
import {
  STORY_FADE,
  holdRange,
  nearestRestingProgress,
  phoneShellTilt,
  presenceKeyframes,
  storySegments,
} from "@/lib/landing/story-timeline";

/** Screen artboard; everything inside the phone is laid out in these units. */
const SCREEN_W = 270;
const SCREEN_H = 585;
const IPHONE_H = 244;
const PRICE_CENTS = 949_900;
const PAID_SHARE = 0.72;

const STEPS = [
  {
    label: "Escolha",
    title: "Escolha o seu iPhone",
    body: "Toque no produto, veja os detalhes e defina uma meta que cabe no seu mês.",
    accent: "#0071e3",
    glow: "rgba(41, 151, 255, 0.22)",
  },
  {
    label: "Aporte via Pix",
    title: "Pague aos poucos, via Pix",
    body: "Reserve e aporte quando quiser, sem juros. A barra enche no seu tempo.",
    accent: "#0071e3",
    glow: "rgba(41, 151, 255, 0.22)",
  },
  {
    label: "Retire",
    title: "Quitou? É seu.",
    body: "Retire nas lojas iPlanet e Restaura Phone, ou receba pelos Correios em todo o Brasil.",
    accent: "#0071e3",
    glow: "rgba(41, 151, 255, 0.22)",
  },
] as const;

const COUNT = STEPS.length;
const SEGMENTS = storySegments(COUNT);
const HALF_FADE = STORY_FADE / 2;
const BOUNDARIES = SEGMENTS.slice(0, -1).map((segment) => segment.end);
const HOLDS = STEPS.map((_, i) => holdRange(i, COUNT));

function usePresence(progress: MotionValue<number>, index: number) {
  const { input, output } = presenceKeyframes(index, COUNT);
  return useTransform(progress, input, output);
}

function useHold(progress: MotionValue<number>, index: number) {
  return useTransform(progress, HOLDS[index]!, [0, 1]);
}

/** Slide in from below, leave upwards; the last step never leaves. */
function useDrift(progress: MotionValue<number>, index: number, distance: number) {
  const { input } = presenceKeyframes(index, COUNT);
  const output =
    input.length === 3 ? [distance, 0, 0] : [distance, 0, 0, -distance];
  return useTransform(progress, input, output);
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function IphoneBack() {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 244" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a2a3a" />
          <stop offset="0.5" stopColor="#4a1622" />
          <stop offset="1" stopColor="#2a0b13" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e7b3bd" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#e7b3bd" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id={`${id}-lens`} cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#5b6b8c" />
          <stop offset="0.45" stopColor="#10131c" />
          <stop offset="1" stopColor="#05060a" />
        </radialGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="116"
        height="240"
        rx="24"
        fill={`url(#${id}-body)`}
        stroke={`url(#${id}-edge)`}
        strokeWidth="2.5"
      />
      <rect x="9" y="11" width="102" height="50" rx="17" fill="#2c0d15" opacity="0.92" />
      {[
        [27, 26],
        [27, 47],
        [45, 36.5],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="9.5" fill="#1a070c" />
          <circle cx={cx} cy={cy} r="7" fill={`url(#${id}-lens)`} />
          <circle cx={cx! - 2} cy={cy! - 2} r="1.6" fill="#ffffff" opacity="0.55" />
        </g>
      ))}
      <circle cx="94" cy="26" r="4" fill="#f1e4cf" opacity="0.9" />
      <circle cx="94" cy="47" r="3.4" fill="#12050a" />
      <rect x="2" y="2" width="58" height="240" rx="24" fill="#ffffff" opacity="0.05" />
    </svg>
  );
}

function StatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 flex h-[44px] items-center justify-between px-[26px] text-[13px] font-semibold text-[#111]">
      <span>9:41</span>
      <span className="flex items-center gap-[5px]">
        <span className="flex items-end gap-[2px]">
          {[5, 7, 9, 11].map((h) => (
            <span key={h} className="w-[3px] rounded-[1px] bg-[#111]" style={{ height: h }} />
          ))}
        </span>
        <span className="relative h-[11px] w-[22px] rounded-[3px] border border-[#111]/60">
          <span className="absolute inset-[1.5px] right-[5px] rounded-[1.5px] bg-[#111]" />
        </span>
      </span>
    </div>
  );
}

function ScreenLayer({
  progress,
  index,
  children,
}: {
  progress: MotionValue<number>;
  index: number;
  children: ReactNode;
}) {
  const opacity = usePresence(progress, index);
  const scale = useTransform(opacity, [0, 1], [0.94, 1]);
  const y = useDrift(progress, index, 18);
  return (
    <motion.div className="absolute inset-0" style={{ opacity, scale, y }}>
      {children}
    </motion.div>
  );
}

function ChooseScreen({ progress }: { progress: MotionValue<number> }) {
  const hold = useHold(progress, 0);
  const cardY = useTransform(hold, [0, 1], [6, -6]);
  const ripple = useTransform(hold, [0.42, 0.66], [0, 2.6]);
  const rippleOpacity = useTransform(hold, [0.42, 0.5, 0.66], [0, 0.4, 0]);
  const buttonFill = useTransform(hold, [0.5, 0.62], [0, 1]);
  const buttonText = useTransform(buttonFill, [0, 1], ["#111111", "#ffffff"]);
  const metaLabel = useTransform<number, string>(hold, (v) =>
    v > 0.58 ? "Meta definida ✓" : "Definir meta",
  );

  return (
    <div className="absolute inset-0 bg-[#f5f5f7]">
      <StatusBar />
      <p className="absolute left-[20px] top-[54px] text-[22px] font-bold tracking-tight text-[#111]">
        Catálogo
      </p>
      <div className="absolute left-[20px] top-[90px] flex gap-[6px]">
        {["iPhone", "Mac", "iPad", "Watch"].map((chip, i) => (
          <span
            key={chip}
            className={`rounded-full px-[11px] py-[5px] text-[11px] font-semibold ${
              i === 0 ? "bg-[#111] text-white" : "bg-white text-[#6e6e73]"
            }`}
          >
            {chip}
          </span>
        ))}
      </div>
      <motion.div
        className="absolute left-[16px] top-[124px] h-[226px] w-[238px] rounded-[26px] bg-gradient-to-b from-white to-[#f3e8ea] shadow-[0_10px_30px_rgba(17,17,17,0.08)]"
        style={{ y: cardY }}
      >
        <div className="absolute inset-x-[18px] bottom-[16px]">
          <p className="text-[15px] font-semibold text-[#111]">iPhone 18 Pro</p>
          <p className="text-[12px] text-[#6e6e73]">A partir de {formatBRL(PRICE_CENTS)}</p>
        </div>
      </motion.div>
      <div className="absolute left-[16px] top-[364px] h-[44px] w-[238px] overflow-hidden rounded-full bg-[#e8e8ed]">
        <motion.span className="absolute inset-0 bg-[#0071e3]" style={{ opacity: buttonFill }} />
        <motion.span
          className="absolute left-1/2 top-1/2 h-[44px] w-[44px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ scale: ripple, opacity: rippleOpacity }}
        />
        <motion.span
          className="relative flex h-full items-center justify-center text-[14px] font-semibold"
          style={{ color: buttonText }}
        >
          {metaLabel}
        </motion.span>
      </div>
      <div className="absolute left-[16px] top-[422px] grid w-[238px] grid-cols-2 gap-[10px]">
        {CHOOSE_TILES.map((tile) => (
          <div key={tile.name} className="h-[118px] rounded-[20px] bg-white p-[12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tile.src}
              alt=""
              width={90}
              height={64}
              draggable={false}
              className="mx-auto h-[64px] w-full object-contain"
            />
            <p className="mt-[10px] text-[11px] font-semibold text-[#111]">{tile.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PayScreen({ progress }: { progress: MotionValue<number> }) {
  const hold = useHold(progress, 1);
  const share = useTransform(hold, [0, 0.9], [0, PAID_SHARE]);
  const circumference = 2 * Math.PI * 86;
  const dashOffset = useTransform(share, (v) => circumference * (1 - v));
  const percent = useTransform(share, (v) => `${Math.round(v * 100)}%`);
  const paid = useTransform(share, (v) => formatBRL(Math.round(PRICE_CENTS * v)));
  const rows = [
    { at: [0.12, 0.26], amount: "R$ 2.000", date: "03 out" },
    { at: [0.38, 0.52], amount: "R$ 2.500", date: "10 out" },
    { at: [0.64, 0.78], amount: "R$ 2.339", date: "17 out" },
  ] as const;
  const gradientId = useId().replace(/:/g, "");

  return (
    <div className="absolute inset-0 bg-[#f5f5f7]">
      <StatusBar />
      <p className="absolute left-[20px] top-[54px] text-[22px] font-bold tracking-tight text-[#111]">
        Sua reserva
      </p>
      <p className="absolute left-[20px] top-[84px] text-[12px] text-[#6e6e73]">
        iPhone 18 Pro · 256 GB
      </p>
      <span className="absolute right-[18px] top-[60px] rounded-full bg-[#30d158]/15 px-[9px] py-[4px] text-[10px] font-bold uppercase tracking-wide text-[#1f9d47]">
        Sem juros
      </span>
      <svg
        className="absolute left-[35px] top-[122px]"
        width="200"
        height="200"
        viewBox="0 0 200 200"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#30d158" />
            <stop offset="1" stopColor="#0071e3" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="86" fill="none" stroke="#e5e5ea" strokeWidth="12" />
        <motion.circle
          cx="100"
          cy="100"
          r="86"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset }}
          transform="rotate(-90 100 100)"
        />
      </svg>
      <div className="absolute inset-x-0 top-[332px] text-center">
        <motion.p className="text-[30px] font-bold tracking-tight text-[#111]">{percent}</motion.p>
        <p className="text-[12px] text-[#6e6e73]">
          <motion.span>{paid}</motion.span> de {formatBRL(PRICE_CENTS)}
        </p>
      </div>
      <div className="absolute left-[16px] top-[400px] w-[238px] space-y-[8px]">
        {rows.map((row) => (
          <PixRow key={row.date} hold={hold} at={row.at} amount={row.amount} date={row.date} />
        ))}
      </div>
    </div>
  );
}

function PixRow({
  hold,
  at,
  amount,
  date,
}: {
  hold: MotionValue<number>;
  at: readonly [number, number];
  amount: string;
  date: string;
}) {
  const opacity = useTransform(hold, [at[0], at[1]], [0, 1]);
  const x = useTransform(hold, [at[0], at[1]], [24, 0]);
  return (
    <motion.div
      className="flex h-[48px] items-center gap-[10px] rounded-[16px] bg-white px-[12px]"
      style={{ opacity, x }}
    >
      <span className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-[#30d158]/15 text-[#1f9d47]">
        <QrCode className="h-[15px] w-[15px]" />
      </span>
      <span className="flex-1">
        <span className="block text-[12px] font-semibold text-[#111]">Pix recebido</span>
        <span className="block text-[10px] text-[#6e6e73]">{date}</span>
      </span>
      <span className="text-[12px] font-semibold text-[#1f9d47]">+ {amount}</span>
    </motion.div>
  );
}

function PickupScreen({ progress }: { progress: MotionValue<number> }) {
  const hold = useHold(progress, 2);
  const checkDraw = useTransform(hold, [0.6, 0.85], [24, 0]);
  const readyOpacity = useTransform(hold, [0.55, 0.7], [0, 1]);
  const storeHighlight = useTransform(hold, [0.7, 0.85], [0, 1]);

  return (
    <div className="absolute inset-0 bg-[#f5f5f7]">
      <StatusBar />
      <p className="absolute left-[20px] top-[54px] text-[22px] font-bold tracking-tight text-[#111]">
        Tudo pronto
      </p>
      <span className="absolute right-[18px] top-[60px] rounded-full bg-[#30d158]/15 px-[9px] py-[4px] text-[10px] font-bold uppercase tracking-wide text-[#1f9d47]">
        Quitado · 100%
      </span>
      <div className="absolute left-[16px] top-[96px] grid w-[238px] grid-cols-2 gap-[10px]">
        <div className="relative h-[86px] overflow-hidden rounded-[18px] bg-white p-[11px]">
          <motion.span
            className="absolute inset-0 rounded-[18px] border-2 border-[#ff9f0a]"
            style={{ opacity: storeHighlight }}
          />
          <Store className="h-[18px] w-[18px] text-[#ff9f0a]" />
          <p className="mt-[8px] text-[11px] font-semibold leading-tight text-[#111]">Retirar na loja</p>
          <p className="text-[9.5px] leading-tight text-[#6e6e73]">iPlanet · Restaura Phone</p>
        </div>
        <div className="h-[86px] rounded-[18px] bg-white p-[11px]">
          <Truck className="h-[18px] w-[18px] text-[#0071e3]" />
          <p className="mt-[8px] text-[11px] font-semibold leading-tight text-[#111]">Receber em casa</p>
          <p className="text-[9.5px] leading-tight text-[#6e6e73]">Correios · todo o Brasil</p>
        </div>
      </div>
      <div className="absolute left-[55px] top-[318px] h-[96px] w-[160px] rounded-[14px] bg-[#dcdce1]" />
      <motion.div
        className="absolute inset-x-0 top-[470px] flex items-center justify-center gap-[8px]"
        style={{ opacity: readyOpacity }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="11" fill="#30d158" />
          <motion.path
            d="M7 12.5l3.2 3.2L17 9"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="24"
            style={{ strokeDashoffset: checkDraw }}
          />
        </svg>
        <span className="text-[14px] font-semibold text-[#111]">Pronto para retirar</span>
      </motion.div>
    </div>
  );
}

/** Front of the box sits above the phone so the phone reads as dropped inside. */
function BoxFront({ progress }: { progress: MotionValue<number> }) {
  const opacity = usePresence(progress, 2);
  return (
    <motion.div
      className="absolute left-[47px] top-[356px] flex h-[78px] w-[176px] items-end justify-center rounded-[14px] bg-gradient-to-b from-white to-[#ececf0] pb-[12px] shadow-[0_-6px_18px_rgba(17,17,17,0.08)]"
      style={{ opacity }}
    >
      <span className="text-[12px] font-bold tracking-tight text-[#111]">
        iPlanet<span className="text-[#0071e3]">Pay</span>
      </span>
    </motion.div>
  );
}

/**
 * The iPhone is the shared element: it is the product you pick, then the one
 * inside the payment ring, then the one that drops into the box.
 */
function TravelingIphone({ progress }: { progress: MotionValue<number> }) {
  const [h0a, h0b] = HOLDS[0]!;
  const [h1a, h1b] = HOLDS[1]!;
  const [h2a, h2b] = HOLDS[2]!;
  const dropEnd = h2a + (h2b - h2a) * 0.5;
  const input = [0, h0a, h0b, h1a, h1b, h2a, dropEnd, 1];
  const centerY = [214, 214, 206, 222, 222, 238, 352, 352];
  const y = useTransform(progress, input, centerY.map((c) => c - IPHONE_H / 2));
  const scale = useTransform(progress, input, [0.62, 0.66, 0.66, 0.5, 0.5, 0.46, 0.4, 0.4]);
  const rotate = useTransform(progress, input, [-14, -10, -5, 0, 0, 4, 0, 0]);

  return (
    <motion.div
      className="absolute left-[75px] top-0 w-[120px]"
      style={{ height: IPHONE_H, y, scale, rotate }}
    >
      <IphoneBack />
    </motion.div>
  );
}

function GlassSweep({ progress }: { progress: MotionValue<number> }) {
  const input = BOUNDARIES.flatMap((b) => [b - HALF_FADE, b, b + HALF_FADE]);
  const x = useTransform(progress, input, BOUNDARIES.flatMap(() => ["-120%", "0%", "120%"]));
  const opacity = useTransform(progress, input, BOUNDARIES.flatMap(() => [0, 0.55, 0]));
  return (
    <motion.div
      className="pointer-events-none absolute inset-y-0 -left-1/2 w-[200%]"
      style={{
        x,
        opacity,
        background:
          "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.75) 50%, transparent 62%)",
      }}
    />
  );
}

function Phone({ progress }: { progress: MotionValue<number> }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setScale(w / SCREEN_W);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [h0a] = HOLDS[0]!;
  const enter = useTransform(progress, [0, h0a], [0, 1]);
  const phoneY = useTransform(enter, [0, 1], [70, 0]);
  const phoneOpacity = useTransform(enter, [0, 0.6], [0, 1]);
  const tilt = useTransform(progress, phoneShellTilt);
  const pulseInput = BOUNDARIES.flatMap((b) => [b - HALF_FADE, b, b + HALF_FADE]);
  const pulse = useTransform(progress, pulseInput, BOUNDARIES.flatMap(() => [1, 0.95, 1]));
  const entryScale = useTransform(enter, [0, 1], [0.86, 1]);
  const phoneScale = useTransform([pulse, entryScale], ([a, b]) => (a as number) * (b as number));

  return (
    <div className="flex h-full items-center justify-center">
      <motion.div
        className="relative h-full max-h-[560px] overflow-hidden bg-gradient-to-br from-[#3a3a3e] via-[#1c1c1f] to-[#2c2c30] p-[3.2%] shadow-[0_40px_90px_rgba(0,0,0,0.55),inset_0_0_0_1.5px_rgba(255,255,255,0.14)]"
        style={{
          borderRadius: "2.75rem",
          aspectRatio: `${SCREEN_W + 18} / ${SCREEN_H + 18}`,
          y: phoneY,
          opacity: phoneOpacity,
          rotate: tilt,
          scale: phoneScale,
        }}
      >
        <div
          ref={screenRef}
          className="relative h-full w-full overflow-hidden bg-[#f5f5f7]"
          style={{ borderRadius: "2.2rem" }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})` }}
          >
            <ScreenLayer progress={progress} index={0}>
              <ChooseScreen progress={progress} />
            </ScreenLayer>
            <ScreenLayer progress={progress} index={1}>
              <PayScreen progress={progress} />
            </ScreenLayer>
            <ScreenLayer progress={progress} index={2}>
              <PickupScreen progress={progress} />
            </ScreenLayer>
            <TravelingIphone progress={progress} />
            <BoxFront progress={progress} />
            <div className="absolute left-1/2 top-[11px] h-[30px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
          </div>
          <GlassSweep progress={progress} />
        </div>
      </motion.div>
    </div>
  );
}

function Glow({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const opacity = usePresence(progress, index);
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{
        opacity,
        background: `radial-gradient(60% 42% at 50% 46%, ${STEPS[index]!.glow} 0%, transparent 70%)`,
      }}
      aria-hidden
    />
  );
}

function ProgressSegment({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const { start, end } = SEGMENTS[index]!;
  const fill = useTransform(progress, [start, end], [0, 1]);
  return (
    <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-black/10">
      <motion.span
        className="absolute inset-0 origin-left rounded-full"
        style={{ scaleX: fill, background: "#0071e3" }}
      />
    </span>
  );
}

function StepCounter({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const opacity = usePresence(progress, index);
  const y = useDrift(progress, index, 14);
  return (
    <motion.span className="absolute right-0 top-0" style={{ opacity, y }}>
      {String(index + 1).padStart(2, "0")}
    </motion.span>
  );
}

function StepCopy({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const step = STEPS[index]!;
  const opacity = usePresence(progress, index);
  const y = useDrift(progress, index, 28);
  const pointerEvents = useTransform(opacity, (v) => (v > 0.6 ? "auto" : "none"));
  return (
    <motion.div className="absolute inset-x-0 bottom-0" style={{ opacity, y, pointerEvents }}>
      <p
        className="text-[12px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: step.accent }}
      >
        Passo {index + 1} · {step.label}
      </p>
      <h3 className="mt-2 text-[28px] font-bold leading-[1.08] tracking-tight text-[#111] [@media(max-height:700px)]:text-[23px]">
        {step.title}
      </h3>
      <p className="mt-2 text-[15px] leading-snug text-[#6e6e73] [@media(max-height:700px)]:text-[13.5px]">
        {step.body}
      </p>
      {index === COUNT - 1 ? (
        <Link
          href="/criar-conta"
          className="mt-4 inline-flex h-11 items-center rounded-full bg-[#111] px-5 text-[15px] font-semibold text-white [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:h-10"
        >
          Começar agora
        </Link>
      ) : null}
    </motion.div>
  );
}

/** Settle on a whole step when scrolling stops mid cross-fade. */
function useMagneticSteps(runwayRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    let touching = false;

    const settle = () => {
      const runway = runwayRef.current;
      if (touching || !runway) return;
      const rect = runway.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      if (distance <= 0) return;
      const target = nearestRestingProgress(-rect.top / distance, COUNT);
      if (target == null) return;
      window.scrollTo({ top: window.scrollY + rect.top + target * distance, behavior: "smooth" });
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 170);
    };
    const onTouchStart = () => {
      touching = true;
      window.clearTimeout(timer);
    };
    const onTouchEnd = () => {
      touching = false;
      schedule();
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [runwayRef, enabled]);
}

function StaticSteps() {
  return (
    <ol className="space-y-4 px-5 pb-16">
      {STEPS.map((step, i) => (
        <li key={step.label} className="rounded-[24px] bg-[#f5f5f7] p-5">
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: step.accent }}
          >
            Passo {i + 1} · {step.label}
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#111]">{step.title}</h3>
          <p className="mt-2 text-[15px] leading-snug text-[#6e6e73]">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** Mobile "Como funciona": one pinned iPhone that walks through the three steps on scroll. */
export function ComoFuncionaStory({ className }: { className?: string }) {
  const runwayRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: ["start start", "end end"],
  });
  useMagneticSteps(runwayRef, !reduceMotion);

  return (
    <div className={className} data-howto-story>
      <div className="bg-white px-5 pb-6 pt-16 text-[#111]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#0071e3]">
          Como funciona
        </p>
        <h2 className="mt-3 text-[40px] font-bold leading-[1.02] tracking-tight">
          Três passos.
          <span className="block text-black/45">Ritmo seu.</span>
        </h2>
        <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-[#6e6e73]">
          Role devagar: cada passo acontece na tela do iPhone.
        </p>
        {reduceMotion ? null : (
          <ChevronDown className="mt-6 h-5 w-5 animate-bounce text-black/35" aria-hidden />
        )}
      </div>

      <ol className="sr-only">
        {STEPS.map((step, i) => (
          <li key={step.label}>
            Passo {i + 1}: {step.title}. {step.body}
          </li>
        ))}
      </ol>

      {reduceMotion ? (
        <div className="bg-white" aria-hidden>
          <StaticSteps />
        </div>
      ) : (
        <div ref={runwayRef} className="relative h-[460svh] bg-white" aria-hidden>
          <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
            {STEPS.map((step, i) => (
              <Glow key={step.label} progress={scrollYProgress} index={i} />
            ))}
            <div className="relative z-10 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-black/45">
              <span className="flex flex-1 gap-[6px]">
                {STEPS.map((step, i) => (
                  <ProgressSegment key={step.label} progress={scrollYProgress} index={i} />
                ))}
              </span>
              <span className="relative h-[16px] w-[22px] text-[#111]">
                {STEPS.map((step, i) => (
                  <StepCounter key={step.label} progress={scrollYProgress} index={i} />
                ))}
              </span>
              <span className="text-black/35">/ 03</span>
            </div>
            <div className="relative z-10 mt-4 min-h-0 flex-1">
              <Phone progress={scrollYProgress} />
            </div>
            <div className="relative z-10 mt-5 h-[184px] shrink-0 [@media(max-height:700px)]:h-[156px]">
              {STEPS.map((step, i) => (
                <StepCopy key={step.label} progress={scrollYProgress} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
