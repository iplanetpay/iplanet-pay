import { useEffect, useMemo, useRef } from 'react';
import type { EffectiveWeather, WeatherKind } from "@/lib/goals/climb/types";

/**
 * Clima da cena, em duas camadas:
 *  - layer="back"  → nuvens (atrás da montanha)
 *  - layer="front" → neblina, chuva, neve, vento, relâmpagos (na frente)
 */
interface Props {
  weather: EffectiveWeather;
  layer: 'back' | 'front';
  /** 0 noite → 1 dia, para escurecer as nuvens */
  light: number;
}

export function Weather({ weather, layer, light }: Props) {
  return layer === 'back' ? (
    <Clouds kind={weather.kind} wind={weather.wind} light={light} />
  ) : (
    <FrontWeather weather={weather} />
  );
}

/* ---------------------------------------------------------------- nuvens */

const CLOUD_COUNT: Record<WeatherKind, number> = {
  clear: 0,
  partly_cloudy: 3,
  cloudy: 5,
  fog: 3,
  rain: 5,
  storm: 6,
  snow: 4,
  blizzard: 5,
};

function cloudColor(kind: WeatherKind, light: number) {
  const gray = kind === 'storm' ? 0.42 : kind === 'rain' ? 0.25 : kind === 'blizzard' ? 0.08 : kind === 'cloudy' ? 0.1 : 0;
  const day = [255 - gray * 255 * 1.1, 255 - gray * 255, 255 - gray * 255 * 0.9];
  const night = [64, 74, 112];
  const c = day.map((d, i) => Math.round(night[i] + (d - night[i]) * light));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function Clouds({ kind, wind, light }: { kind: WeatherKind; wind: number; light: number }) {
  const n = CLOUD_COUNT[kind];
  const clouds = useMemo(() => {
    let seed = 5;
    const r = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: 10 }, (_, i) => ({
      id: i,
      y: 2 + r() * 38,
      s: 0.7 + r() * 0.9,
      d: 0.55 + r() * 0.9,
      delay: -r() * 90,
    }));
  }, []);
  const col = cloudColor(kind, light);
  const speed = 95 - wind * 62; // segundos para atravessar
  return (
    <div className="clouds" aria-hidden>
      {clouds.slice(0, n).map((c) => (
        <svg
          key={c.id}
          className="cloud"
          viewBox="0 0 120 56"
          style={{
            top: `${c.y}%`,
            width: `${150 * c.s}px`,
            animationDuration: `${speed * c.d}s`,
            animationDelay: `${c.delay * c.d}s`,
            opacity: 0.95,
          }}
        >
          <path
            d="M22 48 Q6 48 8 34 Q10 24 24 26 Q30 8 50 10 Q64 2 78 16 Q98 12 104 28 Q118 30 114 42 Q112 50 98 48 Z"
            fill={col}
            fillOpacity="0.92"
          />
        </svg>
      ))}
    </div>
  );
}

/* ---------------------------------------------------- frente: partículas */

function FrontWeather({ weather }: { weather: EffectiveWeather }) {
  const { kind } = weather;
  const fog = kind === 'fog' ? 0.75 : kind === 'cloudy' ? 0.2 : kind === 'blizzard' ? 0.38 : kind === 'rain' ? 0.2 : 0;

  return (
    <>
      {fog > 0 && (
        <div className="fog" style={{ opacity: fog }} aria-hidden>
          <i style={{ top: '38%', animationDuration: '38s' }} />
          <i style={{ top: '58%', animationDuration: '52s', animationDelay: '-20s' }} />
          <i style={{ top: '76%', animationDuration: '44s', animationDelay: '-9s' }} />
        </div>
      )}
      <Particles weather={weather} />
      {(kind === 'storm' || kind === 'blizzard' || kind === 'rain') && weather.wind > 0.5 && (
        <div className="vignette" aria-hidden />
      )}
    </>
  );
}

interface Particle {
  x: number;
  y: number;
  v: number;
  r: number;
  p: number;
  l: number;
}

/** Canvas leve para chuva, neve e rajadas de vento. */
function Particles({ weather }: { weather: EffectiveWeather }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cfg = useRef(weather);
  cfg.current = weather;
  const kind = weather.kind;
  const hasP = kind === 'rain' || kind === 'storm' || kind === 'snow' || kind === 'blizzard' || weather.wind > 0.4;

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !hasP) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      const r = cv.getBoundingClientRect();
      w = r.width;
      h = r.height;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);

    const mk = (): Particle => ({
      x: Math.random() * (w + 200) - 100,
      y: Math.random() * h,
      v: 0.6 + Math.random() * 0.8,
      r: 0.6 + Math.random(),
      p: Math.random() * Math.PI * 2,
      l: 0.5 + Math.random() * 0.8,
    });
    const items: Particle[] = Array.from({ length: 420 }, mk);
    const streaks: Particle[] = Array.from({ length: 16 }, mk);
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = cfg.current;
      const area = Math.min(1, (w * h) / (900 * 560));
      ctx.clearRect(0, 0, w, h);
      const wind = c.wind;
      const isRain = c.kind === 'rain' || c.kind === 'storm';
      const isSnow = c.kind === 'snow' || c.kind === 'blizzard';
      if (isRain || isSnow) {
        const base = isRain ? 50 + 190 * c.intensity : 50 + 230 * c.intensity;
        const count = Math.min(items.length, Math.round(base * (0.45 + 0.55 * area) * (reduce ? 0.4 : 1)));
        if (isRain) {
          ctx.lineCap = 'round';
          for (let i = 0; i < count; i++) {
            const p = items[i];
            const sp = (520 + 520 * p.v) * (0.7 + c.intensity * 0.5);
            const dx = (60 + wind * 340) * p.v;
            p.y += sp * dt;
            p.x += dx * dt;
            if (p.y > h + 20 || p.x > w + 120) {
              p.y = -20;
              p.x = Math.random() * (w + 200) - 160;
            }
            const len = 9 + 12 * p.v;
            ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.25 * p.v})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - (dx / sp) * len, p.y - len);
            ctx.stroke();
          }
        } else {
          for (let i = 0; i < count; i++) {
            const p = items[i];
            const sp = 40 + 70 * p.v;
            p.y += sp * dt * (0.8 + c.intensity * 0.6);
            p.p += dt * (1 + p.v);
            p.x += (Math.sin(p.p) * 24 + (30 + wind * 380) * p.v) * dt;
            if (p.y > h + 6 || p.x > w + 20) {
              p.y = -6;
              p.x = Math.random() * (w + 200) - 160;
            }
            ctx.fillStyle = `rgba(255,255,255,${0.75 + 0.25 * p.v})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1 + p.r * 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // rajadas de vento (linhas curvas horizontais)
      if (wind > 0.4) {
        const n = Math.round(streaks.length * Math.min(1, (wind - 0.3) * 1.6));
        ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {
          const s = streaks[i];
          const sp = 380 + wind * 900 * s.v;
          s.x += sp * dt;
          if (s.x > w + 160) {
            s.x = -220 - Math.random() * 200;
            s.y = Math.random() * h;
          }
          const len = 70 + 110 * s.l;
          ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.16 * wind})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(s.x - len, s.y);
          ctx.bezierCurveTo(s.x - len * 0.6, s.y - 8, s.x - len * 0.3, s.y + 8, s.x, s.y - 2);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [hasP]);

  if (!hasP) return null;
  return <canvas ref={ref} className="particles" aria-hidden />;
}
