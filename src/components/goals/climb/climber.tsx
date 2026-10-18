import { useEffect, useRef, type MutableRefObject } from 'react';

/**
 * Escalador: silhueta azul simples, desenhada em coordenadas locais
 * (pés em (0,0), olhando para a direita, ~44 unidades de altura).
 *
 * A animação é feita por um laço de rAF que atualiza os ângulos das juntas,
 * sem keyframes: todos os parâmetros (passada, braços, inclinação, comemoração)
 * são suavizados exponencialmente, então não há trancos ao começar/parar.
 *  - `speedRef`  velocidade real ao longo da trilha (unid. de mundo/s) → cadência e amplitude do passo
 *  - `bow`       0–1: cabeça/tronco levemente inclinados (meta atrasada)
 *  - `celebrate` braços para o alto, suave
 */
interface Props {
  speedRef: MutableRefObject<number>;
  bow?: number;
  celebrate?: boolean;
}

const BLUE = "#0071e3";
const BLUE_BACK = '#7dbbff';

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function Climber({ speedRef, bow = 0, celebrate = false }: Props) {
  const r = {
    bob: useRef<SVGGElement>(null),
    upper: useRef<SVGGElement>(null),
    head: useRef<SVGGElement>(null),
    armF: useRef<SVGGElement>(null),
    foreF: useRef<SVGGElement>(null),
    armB: useRef<SVGGElement>(null),
    foreB: useRef<SVGGElement>(null),
    thighF: useRef<SVGGElement>(null),
    shinF: useRef<SVGGElement>(null),
    thighB: useRef<SVGGElement>(null),
    shinB: useRef<SVGGElement>(null),
  };
  const target = useRef({ bow, celebrate });
  target.current = { bow, celebrate };

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const S = { phase: 0, t: 0, f: 0, raise: 0, bow: 0 };
    let last = performance.now();
    let raf = 0;
    const rot = (el: SVGGElement | null, a: number) => el?.setAttribute('transform', `rotate(${a.toFixed(2)})`);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      S.t += dt;
      const tg = target.current;
      const k = 1 - Math.exp(-dt * 4.5);
      const kSlow = 1 - Math.exp(-dt * 2.2);
      const fT = reduce ? 0 : clamp01(speedRef.current / 95);
      S.f += (fT - S.f) * k;
      S.raise += ((tg.celebrate ? 1 : 0) - S.raise) * kSlow;
      S.bow += (tg.bow - S.bow) * kSlow;
      const f = S.f;
      S.phase += dt * TAU * (0.62 + 0.55 * f); // cadência suave
      const ph = S.phase;

      // pernas (a de trás está defasada meio ciclo)
      const leg = (p: number) => {
        const hip = -5 * f - 26 * f * Math.sin(p);
        const swing = Math.max(0, Math.cos(p));
        const knee = 4 + 56 * f * swing * swing;
        return [hip, knee] as const;
      };
      const [hF, kF] = leg(ph);
      const [hB, kB] = leg(ph + Math.PI);
      // repouso: leve afastamento das pernas
      const stance = (1 - f) * (1 - S.raise);
      rot(r.thighF.current, hF - 7 * stance);
      rot(r.shinF.current, kF + 6 * stance);
      rot(r.thighB.current, hB + 9 * stance);
      rot(r.shinB.current, kB);

      // braços (opostos às pernas) + comemoração
      const wave = Math.sin(S.t * 1.9) * 7 * S.raise;
      const rest = 1 - f;
      const aF = lerp(-6 * rest + 24 * f * Math.sin(ph), -152 + wave, S.raise);
      const aB = lerp(16 * rest - 24 * f * Math.sin(ph), 150 - wave, S.raise);
      rot(r.armF.current, aF);
      rot(r.armB.current, aB);
      const elbow = (12 + 10 * f) * (1 - S.raise);
      rot(r.foreF.current, -elbow);
      rot(r.foreB.current, -elbow);

      // corpo: oscilação suave, respiração e inclinação
      const bobY = -1.1 * f * (0.5 + 0.5 * Math.cos(2 * ph)) - S.raise * 1.4 * (0.5 + 0.5 * Math.sin(S.t * 1.9)) + 0.28 * Math.sin(S.t * 1.7) * (1 - f);
      r.bob.current?.setAttribute('transform', `translate(0 ${bobY.toFixed(3)})`);
      rot(r.upper.current, 4 + 5 * f + 10 * S.bow - 4 * S.raise);
      rot(r.head.current, 9 * S.bow - 6 * S.raise + 1.2 * Math.sin(S.t * 1.7));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [
    speedRef,
    r.armB,
    r.armF,
    r.bob,
    r.foreB,
    r.foreF,
    r.head,
    r.shinB,
    r.shinF,
    r.thighB,
    r.thighF,
    r.upper,
  ]);

  const limb = (stroke: string, w: number) => ({ stroke, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });

  return (
    <g className="climber">
      <ellipse cx="0.5" cy="0.6" rx="8" ry="1.3" fill="#000" opacity="0.08" />
      <g ref={r.bob}>
        {/* perna de trás */}
        <g transform="translate(0 -17)">
          <g ref={r.thighB}>
            <path d="M0 0 L0 8.6" {...limb(BLUE_BACK, 3.8)} />
            <g transform="translate(0 8.6)">
              <g ref={r.shinB}>
                <path d="M0 0 L0 8.2 L2.8 8.2" {...limb(BLUE_BACK, 3.6)} />
              </g>
            </g>
          </g>
        </g>

        {/* tronco + cabeça + braços (tudo gira junto com a inclinação) */}
        <g transform="translate(0 -17)">
          <g ref={r.upper}>
            <g transform="translate(0.4 -12.8)">
              <g ref={r.armB}>
                <path d="M0 0 L0 6" {...limb(BLUE_BACK, 2.8)} />
                <g transform="translate(0 6)">
                  <g ref={r.foreB}>
                    <path d="M0 0 L0 5.8" {...limb(BLUE_BACK, 2.6)} />
                  </g>
                </g>
              </g>
            </g>
            <path d="M0 0 L0.5 -13.5" {...limb(BLUE, 7.2)} />
            <g transform="translate(0.9 -16)">
              <g ref={r.head}>
                <circle cx="0.4" cy="-5.6" r="5.2" fill={BLUE} />
              </g>
            </g>
            <g transform="translate(0.6 -12.8)">
              <g ref={r.armF}>
                <path d="M0 0 L0 6" {...limb(BLUE, 3)} />
                <g transform="translate(0 6)">
                  <g ref={r.foreF}>
                    <path d="M0 0 L0 5.8" {...limb(BLUE, 2.8)} />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* perna da frente */}
        <g transform="translate(0 -17)">
          <g ref={r.thighF}>
            <path d="M0 0 L0 8.6" {...limb(BLUE, 3.9)} />
            <g transform="translate(0 8.6)">
              <g ref={r.shinF}>
                <path d="M0 0 L0 8.2 L3 8.2" {...limb(BLUE, 3.7)} />
              </g>
            </g>
          </g>
        </g>

      </g>
    </g>
  );
}
