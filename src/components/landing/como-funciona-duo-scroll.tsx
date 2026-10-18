"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { MotionFade } from "@/components/ui/motion";
import { IphoneDuoScrollClient } from "@/components/landing/iphone-duo-scroll-client";
import { ComoFuncionaStory } from "@/components/landing/como-funciona-story";

/**
 * Scroll runway while the phone is pinned in the viewport (vh).
 * Longer = slower unfold. Pin uses position:fixed (Lenis-safe).
 */
const PIN_VH_DESKTOP = 145;
/** Shorter runway on phones so one step sits closer to the next. */
const PIN_VH_MOBILE = 62;
/** Sticky landing header ~56–64px; keep a thin clearance so closed portrait isn’t clipped. */
const PIN_TOP = 48;
/**
 * Optical lift: open landscape Duo reads low when truly centered in the
 * leftover viewport — nudge up so it sits in the visual middle.
 */
const VISUAL_LIFT = "-9vh";
/**
 * 0–holdClosed: closed, centered
 * holdClosed–openEnd: smooth unfold (still centered)
 * openEnd–1: fully open & readable, then release
 */
const HOLD_CLOSED = 0.08;
const OPEN_END = 0.78;

const STEPS = [
  {
    n: 1,
    outer: "/images/duo-scroll/step-1-outer.png",
    inner: "/images/duo-scroll/step-1-inner.png",
  },
  {
    n: 2,
    outer: "/images/duo-scroll/step-2-outer.png",
    inner: "/images/duo-scroll/step-2-inner.png",
  },
  {
    n: 3,
    outer: "/images/duo-scroll/step-3-outer.png",
    inner: "/images/duo-scroll/step-3-inner.png",
  },
] as const;

type PinPhase = "before" | "pinned" | "after";

function mapScrollToFold(t: number): number {
  if (t <= HOLD_CLOSED) return 0;
  if (t >= OPEN_END) return 1;
  const linear = (t - HOLD_CLOSED) / (OPEN_END - HOLD_CLOSED);
  // Smoothstep — gentle open that finishes while still pinned
  return linear * linear * (3 - 2 * linear);
}

const DESKTOP_DUO_MQ = "(min-width: 768px)";
/** Slightly larger on desktop via the vendor camera — avoid CSS scale (misaligns the canvas). */
const PHONE_SIZE_DESKTOP = 1.18;

function useDuoLayout() {
  /** null until measured, so phones never mount the WebGL Duo. */
  const [desktop, setDesktop] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia(DESKTOP_DUO_MQ);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return {
    desktop,
    phoneSize: desktop ? PHONE_SIZE_DESKTOP : 1,
    pinVh: desktop ? PIN_VH_DESKTOP : PIN_VH_MOBILE,
    mobile: !desktop,
  };
}

function pinWindowPx(mobile: boolean) {
  const viewport = window.innerHeight;
  return mobile ? Math.round(viewport * 0.46) : Math.max(1, viewport - PIN_TOP);
}

function DuoPinnedStep({
  step,
  phoneSize,
  pinVh,
  mobile,
}: {
  step: (typeof STEPS)[number];
  phoneSize: number;
  pinVh: number;
  mobile: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [foldProgress, setFoldProgress] = useState(0);
  const [phase, setPhase] = useState<PinPhase>("before");

  const mobileRef = useRef(mobile);
  mobileRef.current = mobile;

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pinH = pinWindowPx(mobileRef.current);
    const range = Math.max(1, rect.height - pinH);

    // before: track hasn't reached the pin line yet
    if (rect.top > PIN_TOP) {
      setPhase("before");
      setFoldProgress(0);
      return;
    }

    // after: scrolled past the pin window — park phone at end of track
    if (rect.bottom <= PIN_TOP + pinH) {
      setPhase("after");
      setFoldProgress(1);
      return;
    }

    // pinned: keep phone fixed & centered; map scroll → fold
    setPhase("pinned");
    const scrolled = Math.min(range, Math.max(0, PIN_TOP - rect.top));
    setFoldProgress(mapScrollToFold(scrolled / range));
  }, []);

  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          update();
        });
      }
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [update]);

  // dvh tracks window.innerHeight (used by pinWindowPx); vh on iOS Safari is
  // the toolbar-hidden height and makes the pinned stage overshoot.
  const pinH = mobile ? "46dvh" : `calc(100dvh - ${PIN_TOP}px)`;

  const stageStyle: CSSProperties =
    phase === "pinned"
      ? {
          position: "fixed",
          top: PIN_TOP,
          left: 0,
          right: 0,
          height: pinH,
          zIndex: 20 + step.n,
          display: "grid",
          placeItems: "center",
          background: "#ffffff",
        }
      : phase === "after"
        ? {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: pinH,
            display: "grid",
            placeItems: "center",
            background: "#ffffff",
          }
        : {
            position: "relative",
            height: pinH,
            display: "grid",
            placeItems: "center",
            background: "#ffffff",
          };

  return (
    <div
      ref={trackRef}
      className="relative w-full"
      data-duo-step={step.n}
      style={{ height: `${pinVh}vh` }}
    >
      <div
        style={{
          ...stageStyle,
          placeItems: mobile && phase !== "pinned" ? "start center" : "center",
        }}
      >
        <div
          className="w-full"
          style={{
            // Mobile: shorter frame pinned to the top so copy and the next
            // step sit close. Desktop stays full-height and centered.
            height: "100%",
            transform:
              phase === "before" || mobile
                ? undefined
                : `translateY(${VISUAL_LIFT})`,
          }}
        >
          <IphoneDuoScrollClient
            foldProgress={foldProgress}
            interactionMode="scroll"
            reverseAnimation={false}
            phoneSize={phoneSize}
            phoneFinish="star-white"
            background="#ffffff"
            screen="custom"
            imageFit="cover"
            outerImage={{ src: step.outer }}
            innerImage={{ src: step.inner }}
            lockScreenUI={{
              showClock: false,
              showWifi: false,
              showQuickActions: false,
            }}
            screenBlur={1}
            screenReflection={0}
            loaderColor="#858580"
            loaderOpacity={0.5}
            loaderStyle="fold"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Three Framer iPhone Duo Scroll units (one per step).
 * Fixed pin: enter closed → centered → slow open → hold open → release.
 */
export function ComoFuncionaDuoScroll() {
  const { desktop, phoneSize, pinVh, mobile } = useDuoLayout();

  return (
    <section id="como-funciona-duo" className="relative bg-white text-[#111]">
      <ComoFuncionaStory className="md:hidden" />
      {desktop ? (
        <DesktopDuoSteps phoneSize={phoneSize} pinVh={pinVh} mobile={mobile} />
      ) : null}
    </section>
  );
}

function DesktopDuoSteps({
  phoneSize,
  pinVh,
  mobile,
}: {
  phoneSize: number;
  pinVh: number;
  mobile: boolean;
}) {
  return (
    <>
      <div className="relative z-30 mx-auto max-w-6xl px-4 pb-2 pt-10 md:px-8 md:pb-12 md:pt-24">
        <MotionFade>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Como funciona
          </p>
          <h2 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
            Três passos. Ritmo seu.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#6e6e73] md:text-lg">
            Cada passo é um iPhone Duo: fechado mostra o número; role para abrir
            e ler o passo — escolha, aporte via Pix e retire na loja ou receba
            pelos correios em todo o Brasil.
          </p>
        </MotionFade>
      </div>

      {STEPS.map((step) => (
        <DuoPinnedStep
          key={step.n}
          step={step}
          phoneSize={phoneSize}
          pinVh={pinVh}
          mobile={mobile}
        />
      ))}
    </>
  );
}
