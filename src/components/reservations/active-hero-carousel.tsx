"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, QrCode } from "lucide-react";
import { ProductHeroCard } from "@/components/ui/product-hero-card";
import { ProductImage } from "@/components/products/product-image";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Button } from "@/components/ui/button";
import {
  reservationKeyDelta,
  showReservationArrows,
  stepReservationIndex,
} from "@/lib/reservations/hero-carousel";
import { cn } from "@/lib/utils";

export type ActiveHeroItem = {
  id: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  imageUrl: string | null;
  progress: number;
};

const ROTATE_MS = 10_000;

export function ActiveHeroCarousel({ items }: { items: ActiveHeroItem[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const count = items.length;

  useEffect(() => {
    if (items.length === 0) return;
    const id = window.setTimeout(() => {
      for (const item of items.slice(0, 3)) {
        router.prefetch(`/app/reserva/${item.id}`);
      }
    }, 1200);
    return () => window.clearTimeout(id);
  }, [items, router]);

  // Restarts on every index change so a manual step gets a full ROTATE_MS.
  useEffect(() => {
    if (count <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => stepReservationIndex(i, 1, count));
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, index]);

  if (count === 0) return null;

  const safeIndex = stepReservationIndex(index, 0, count);
  const arrows = showReservationArrows(count);

  function step(delta: number) {
    if (!arrows) return;
    setIndex((prev) => stepReservationIndex(prev, delta, count));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = reservationKeyDelta(event.key);
    if (delta === 0 || !arrows) return;
    event.preventDefault();
    step(delta);
  }

  return (
    <div
      className="space-y-3"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Reservas ativas"
      onKeyDown={onKeyDown}
    >
      <div className="grid">
        {items.map((hero, i) => {
          const active = i === safeIndex;
          return (
            <div
              key={hero.id}
              className={cn(
                "col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
                active
                  ? "z-10 translate-y-0 opacity-100"
                  : "pointer-events-none z-0 translate-y-2 opacity-0",
              )}
              aria-hidden={!active}
              inert={!active}
            >
              <ProductHeroCard
                badge="Reserva ativa"
                title={hero.title}
                subtitle={hero.subtitle}
                priceLabel={hero.priceLabel}
                imageSlot={
                  <ProductImage
                    src={hero.imageUrl}
                    alt={hero.title}
                    size="hero"
                    className="h-full w-full bg-transparent"
                  />
                }
                footer={
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <ProgressRing value={hero.progress} label="quitado" />
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/app/reserva/${hero.id}`} prefetch>
                        <Button size="sm">
                          Ver reserva
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/app/reserva/${hero.id}`} prefetch>
                        <Button
                          size="sm"
                          variant="accent"
                          leftIcon={<QrCode className="h-4 w-4" />}
                        >
                          Gerar aporte Pix
                        </Button>
                      </Link>
                    </div>
                  </div>
                }
              />
            </div>
          );
        })}
      </div>

      {arrows ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Reserva anterior"
            onClick={() => step(-1)}
            className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-black/5 bg-white/85 text-[var(--ink)] shadow-[0_8px_24px_rgba(17,17,17,0.12)] backdrop-blur-md transition active:scale-90"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div
            className="flex items-center justify-center gap-2"
            role="tablist"
            aria-label="Escolher reserva"
          >
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === safeIndex}
                aria-label={`Reserva ${i + 1} de ${count}`}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  i === safeIndex
                    ? "w-6 bg-[var(--accent)]"
                    : "w-2.5 bg-[var(--line)] hover:bg-[var(--ink-muted)]",
                )}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Próxima reserva"
            onClick={() => step(1)}
            className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full bg-[var(--ink)] text-white shadow-[0_10px_28px_rgba(17,17,17,0.28)] transition hover:scale-105 active:scale-90"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
