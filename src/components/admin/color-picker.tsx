"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  FAVORITE_COLORS,
  hexToHsv,
  hsvToHex,
  isLightHex,
  normalizeHex,
} from "@/lib/catalog/colors";

/**
 * Seletor de cor completo do admin: favoritas (cores de celular), área saturação/brilho,
 * faixa de matiz, campo hex e o seletor nativo do navegador como alternativa.
 * `onPickFavorite` também devolve o nome, para preencher o campo "Cor" quando vazio.
 */
export function ColorPicker({
  value,
  onChange,
  onPickFavorite,
  label = "Cor (hex)",
}: {
  value: string | null;
  onChange: (hex: string) => void;
  onPickFavorite?: (name: string, hex: string) => void;
  label?: string;
}) {
  const current = normalizeHex(value) ?? "#1D1D1F";
  const [hsv, setHsv] = useState(() => hexToHsv(current));
  const [text, setText] = useState(current);

  // valor externo mudou (ex.: favorito, edição de outra variante)
  useEffect(() => {
    setText(current);
    if (hsvToHex(hsv.h, hsv.s, hsv.v) !== current) setHsv(hexToHsv(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const emit = (h: number, s: number, v: number) => {
    setHsv({ h, s, v });
    const hex = hsvToHex(h, s, v);
    setText(hex);
    onChange(hex);
  };

  const drag = (fn: (x: number, y: number) => void) => (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const move = (e: PointerEvent | ReactPointerEvent) => {
      const r = el.getBoundingClientRect();
      fn(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
    };
    move(event);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pure = hsvToHex(hsv.h, 1, 1);

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-3" data-testid="color-picker">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span
          className="h-7 w-7 rounded-full border border-black/10 shadow-inner"
          style={{ backgroundColor: current }}
          aria-label={`Cor atual ${current}`}
        />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Favoritas</p>
        <div className="flex flex-wrap gap-1.5">
          {FAVORITE_COLORS.map((c) => {
            const on = c.hex === current;
            return (
              <button
                key={c.name}
                type="button"
                title={`${c.name} · ${c.hex}`}
                aria-label={c.name}
                aria-pressed={on}
                onClick={() => {
                  setHsv(hexToHsv(c.hex));
                  onChange(c.hex);
                  onPickFavorite?.(c.name, c.hex);
                }}
                className={`h-7 w-7 rounded-full border shadow-inner transition-transform hover:scale-110 ${on ? "ring-2 ring-[var(--accent)] ring-offset-2" : "border-black/10"}`}
                style={{ backgroundColor: c.hex }}
              >
                {on ? <span className={`text-[10px] font-bold ${isLightHex(c.hex) ? "text-black" : "text-white"}`}>✓</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="slider"
        aria-label="Saturação e brilho"
        aria-valuenow={Math.round(hsv.s * 100)}
        tabIndex={0}
        onPointerDown={drag((x, y) => emit(hsv.h, x, 1 - y))}
        className="relative h-36 w-full cursor-crosshair touch-none rounded-xl"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})` }}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: current }}
        />
      </div>
      <div
        role="slider"
        aria-label="Matiz"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        tabIndex={0}
        onPointerDown={drag((x) => emit(Math.min(359.9, x * 360), hsv.s, hsv.v))}
        className="relative h-3.5 w-full cursor-pointer touch-none rounded-full"
        style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: pure }}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          aria-label="Hex"
          value={text}
          maxLength={7}
          onChange={(e) => {
            setText(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex && e.target.value.replace("#", "").length === 6) {
              setHsv(hexToHsv(hex));
              onChange(hex);
            }
          }}
          onBlur={() => setText(current)}
          className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--line)] px-3 font-mono text-sm uppercase"
        />
        <input
          type="color"
          aria-label="Seletor nativo"
          value={current.toLowerCase()}
          onChange={(e) => {
            const hex = normalizeHex(e.target.value);
            if (hex) {
              setHsv(hexToHsv(hex));
              onChange(hex);
            }
          }}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border border-[var(--line)] bg-white p-1"
        />
      </div>
    </div>
  );
}
