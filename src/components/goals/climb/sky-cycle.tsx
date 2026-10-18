import { useMemo } from 'react';
import type { SkyState } from '@/lib/goals/climb/sky';

/** Céu minimalista: gradiente suave, sol e lua simples, poucas estrelas. */
export function SkyCycle({ sky }: { sky: SkyState }) {
  const stars = useMemo(() => {
    let seed = 11;
    const r = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: 34 }, (_, i) => ({ id: i, x: r() * 100, y: r() * 55, s: 1 + r() * 1.4, d: 3 + r() * 4, delay: -r() * 5 }));
  }, []);

  return (
    <div className="sky" style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.bottom} 100%)` }} aria-hidden>
      <div className="sky-stars" style={{ opacity: sky.starsOpacity }}>
        {stars.map((s) => (
          <i key={s.id} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDuration: `${s.d}s`, animationDelay: `${s.delay}s` }} />
        ))}
      </div>
      <div className="sky-sun" style={{ left: `${sky.bodyX}%`, top: `${sky.bodyY}%`, opacity: sky.sunOpacity }} />
      <div className="sky-moon" style={{ left: `${sky.bodyX}%`, top: `${sky.bodyY}%`, opacity: sky.moonOpacity }} />
    </div>
  );
}
