"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, QrCode } from "lucide-react";
import { ProductHeroCard } from "@/components/ui/product-hero-card";
import { ProductImage } from "@/components/products/product-image";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (count <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count]);

  if (count === 0) return null;

  const safeIndex = ((index % count) + count) % count;

  return (
    <div className="space-y-3">
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
                    <div className="flex-1 space-y-4">
                      <ProgressBar
                        value={hero.progress}
                        label="Progresso da reserva"
                      />
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
                  </div>
                }
              />
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <div
          className="flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Reservas ativas"
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
      ) : null}
    </div>
  );
}
