"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCentsBRL } from "@/lib/utils";
import { swatchHex } from "@/lib/catalog/colors";

export function conditionFromName(name: string, category?: string | null): "Lacrado" | "Semi" {
  return /semi|usado|seminovo/i.test(`${name} ${category ?? ""}`) ? "Semi" : "Lacrado";
}

export function CatalogProductCard({
  name,
  meta,
  condition,
  priceCents,
  images,
  colors,
  onDetails,
  picker,
  exactPrice = false,
  colorHexes = {},
}: {
  name: string;
  meta: string;
  condition: "Lacrado" | "Semi";
  priceCents: number;
  images: string[];
  colors: string[];
  onDetails: () => void;
  /** Seletor de Cor/Armazenamento; substitui as bolinhas de cor. */
  picker?: ReactNode;
  /** Preço da variante escolhida (sem "A partir de"). */
  exactPrice?: boolean;
  /** Hex por nome de cor (color_hex do produto/variantes). */
  colorHexes?: Record<string, string>;
}) {
  const shots = images.length > 0 ? images : [];
  const [index, setIndex] = useState(0);
  const safeIndex = shots.length ? index % shots.length : 0;
  const firstShot = shots[0];
  // nova cor escolhida → volta para a primeira foto (a da cor)
  useEffect(() => setIndex(0), [firstShot]);
  const installment = Math.round(priceCents / 12);
  const dots = colors.length > 0 ? colors : ["Padrão"];

  function step(delta: number) {
    if (shots.length < 2) return;
    setIndex((current) => (current + delta + shots.length) % shots.length);
  }

  return (
    <article className="flex h-full flex-col rounded-[28px] border border-[#ececef] bg-white p-4 shadow-[0_10px_30px_rgba(17,17,17,0.06)]">
      <div className="relative flex aspect-[1.05/1] items-center justify-center rounded-[22px] bg-white">
        {shots.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={() => step(-1)}
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#e6e6ea] bg-white text-[var(--ink)] shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={() => step(1)}
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#e6e6ea] bg-white text-[var(--ink)] shadow-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}
        {shots[safeIndex] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={shots[safeIndex]}
            src={shots[safeIndex]}
            alt={name}
            className="h-[78%] w-auto object-contain animate-[catalog-fade_.35s_ease]"
            draggable={false}
          />
        ) : (
          <div className="h-24 w-16 rounded-2xl bg-[#e7e7ec]" />
        )}
        {shots.length > 1 ? (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {shots.map((_, i) => (
              <span
                key={i}
                className={
                  i === safeIndex
                    ? "h-1.5 w-4 rounded-full bg-[#1d1d1f]"
                    : "h-1.5 w-1.5 rounded-full bg-[#c7c7cc]"
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
        <h3 className="text-[1.35rem] font-bold tracking-tight text-[var(--ink)]">{name}</h3>
        <p className="mt-1 text-sm text-[#6e6e73]">{meta}</p>
        <span
          className={
            condition === "Lacrado"
              ? "mt-3 inline-flex w-fit rounded-full bg-[#e8f8ee] px-3 py-1 text-xs font-semibold text-[#1f8a4c]"
              : "mt-3 inline-flex w-fit rounded-full bg-[#f2f2f4] px-3 py-1 text-xs font-semibold text-[#6e6e73]"
          }
        >
          {condition}
        </span>
        <p className="mt-4 text-sm text-[#6e6e73]">{exactPrice ? "Preço" : "A partir de"}</p>
        <p key={priceCents} className="text-[1.65rem] font-bold leading-none tracking-tight text-[var(--ink)] tabular-nums animate-[catalog-fade_.35s_ease]" data-testid="catalog-price">
          {formatCentsBRL(priceCents)}
        </p>
        <p className="mt-1 text-sm text-[#6e6e73]">
          ou 12x de {formatCentsBRL(installment)}
        </p>
        {picker ?? (
          <div className="mt-3 flex items-center gap-2">
            {dots.slice(0, 6).map((color) => (
              <span
                key={color}
                title={color}
                aria-label={color}
                role="img"
                className="h-4 w-4 rounded-full border border-black/10 shadow-inner"
                style={{ backgroundColor: swatchHex(color, colorHexes[color]) }}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onDetails}
          className="mt-4 h-12 w-full rounded-full border border-[#d8d8de] text-base font-semibold text-[var(--ink)]"
        >
          Ver detalhes
        </button>
      </div>
    </article>
  );
}
