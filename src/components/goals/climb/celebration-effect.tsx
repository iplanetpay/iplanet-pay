import { useEffect, useRef } from 'react';

/** Confete discreto e elegante: poucas peças pequenas, pastéis, caindo devagar. */
export function CelebrationEffect({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !active) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
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
    const COLORS = ['#0a84ff', '#64d2ff', '#ffd60a', '#ff9f0a', '#bf5af2', '#30d158'];
    const N = reduce ? 0 : 38;
    const items = Array.from({ length: N }, () => ({
      x: Math.random() * 100,
      y: -Math.random() * 120,
      v: 28 + Math.random() * 30,
      s: 3.5 + Math.random() * 3,
      ph: Math.random() * 6.28,
      sw: 10 + Math.random() * 14,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * 3,
    }));
    let t = 0;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, w, h);
      for (const p of items) {
        p.y += p.v * dt;
        if (p.y > h + 10) {
          p.y = -10;
          p.x = Math.random() * 100;
        }
        const x = (p.x / 100) * w + Math.sin(t * 0.9 + p.ph) * p.sw;
        const fade = Math.min(1, Math.max(0, p.y / 40)) * 0.85;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(x, p.y);
        ctx.rotate(p.rot + t * 0.6);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.roundRect(-p.s / 2, -p.s / 4, p.s, p.s / 2, 1);
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [active]);
  if (!active) return null;
  return <canvas ref={ref} className="celebration" aria-hidden />;
}
