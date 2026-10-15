"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  motion,
  useMotionValue,
  animate,
  type PanInfo,
} from "framer-motion";
import type { Product } from "@/types/database";
import {
  CatalogProductCard,
  conditionFromName,
} from "@/components/catalog/catalog-product-card";

const GAP = 28;
const AUTOPLAY_MS = 5000;

function groupProducts(products: Product[]) {
  const groups: Array<{
    key: string;
    name: string;
    storage: string;
    priceCents: number;
    images: string[];
    colors: string[];
    category: string | null;
    product: Product;
  }> = [];
  const indexByKey = new Map<string, number>();
  for (const product of products) {
    const key = (product.model || product.name).trim().toLowerCase();
    const images = [product.image_url, ...(product.product_images ?? [])].filter(
      (url): url is string => Boolean(url),
    );
    const color = product.color?.trim();
    const existing = indexByKey.get(key);
    if (existing == null) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        name: product.model || product.name,
        storage: product.storage,
        priceCents: product.list_price_cents,
        images,
        colors: color ? [color] : [],
        category: product.category ?? null,
        product,
      });
      continue;
    }
    const group = groups[existing]!;
    if (product.list_price_cents < group.priceCents) {
      group.priceCents = product.list_price_cents;
      group.product = product;
      group.storage = product.storage;
    }
    for (const image of images) {
      if (!group.images.includes(image)) group.images.push(image);
    }
    if (color && !group.colors.includes(color)) group.colors.push(color);
  }
  return groups;
}

export function VelocityCatalogCarousel({
  products,
  onSelect,
  swatches = {},
}: {
  products: Product[];
  onSelect: (p: Product) => void;
  swatches?: Record<string, string[]>;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [cardW, setCardW] = useState(340);
  const [viewportW, setViewportW] = useState(0);
  const [paused, setPaused] = useState(false);
  const x = useMotionValue(0);

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    setViewportW(vw);
    // Large cards that peek neighbors — Velocity spirit
    const next = Math.min(400, Math.max(260, Math.round(vw * 0.72)));
    setCardW(next);
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const offsetFor = useCallback(
    (i: number) => {
      const center = viewportW / 2 - cardW / 2;
      return center - i * (cardW + GAP);
    },
    [viewportW, cardW],
  );

  useEffect(() => {
    if (!viewportW) return;
    const controls = animate(x, offsetFor(index), {
      type: "spring",
      stiffness: 260,
      damping: 32,
      mass: 0.85,
    });
    return () => controls.stop();
  }, [index, offsetFor, viewportW, x]);

  const slideCount = Math.max(groupProducts(products).length, 1);

  function goTo(i: number) {
    if (products.length === 0) return;
    const next = ((i % slideCount) + slideCount) % slideCount;
    setIndex(next);
  }

  // Autoplay every 5s; pause while dragging; reset on index change
  useEffect(() => {
    if (slideCount < 2 || paused) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slideCount);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [slideCount, paused, index]);

  function onDragEnd(_: unknown, info: PanInfo) {
    setPaused(false);
    const threshold = cardW * 0.18;
    const velocity = info.velocity.x;
    let next = index;
    if (info.offset.x < -threshold || velocity < -400) next = index + 1;
    else if (info.offset.x > threshold || velocity > 400) next = index - 1;
    goTo(next);
  }

  const groups = groupProducts(products).map((group) => {
    const extra = swatches[group.product.id] ?? [];
    const colors = [...group.colors];
    for (const color of extra) {
      if (color && !colors.includes(color)) colors.push(color);
    }
    const colorLabel = colors.length === 1 ? "1 cor" : `${colors.length} cores`;
    return {
      ...group,
      colors,
      meta: [group.storage, colorLabel].filter(Boolean).join(" · "),
    };
  });

  if (groups.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-[var(--ink-muted)]">
        Nenhum produto nesta categoria.
      </p>
    );
  }

  return (
    <div className="relative">
      <div
        ref={viewportRef}
        className="relative overflow-hidden py-4"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)",
        }}
      >
        <motion.div
          className="flex cursor-grab items-stretch active:cursor-grabbing"
          style={{ x, gap: GAP }}
          drag="x"
          dragConstraints={{
            left: offsetFor(groups.length - 1) - 40,
            right: offsetFor(0) + 40,
          }}
          dragElastic={0.12}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerCancel={() => setPaused(false)}
          onDragStart={() => setPaused(true)}
          onDragEnd={onDragEnd}
        >
          {groups.map((group, i) => {
            const dist = Math.abs(i - index);
            const scale = dist === 0 ? 1 : dist === 1 ? 0.9 : 0.82;
            const opacity = dist === 0 ? 1 : dist === 1 ? 0.72 : 0.45;
            const z = 20 - dist;

            return (
              <motion.div
                key={group.key}
                animate={{ scale, opacity }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                style={{ width: cardW, zIndex: z }}
                className="relative shrink-0"
              >
                <CatalogProductCard
                  name={group.name}
                  meta={group.meta}
                  condition={conditionFromName(group.name, group.category)}
                  priceCents={group.priceCents}
                  images={group.images}
                  colors={group.colors}
                  onDetails={() => {
                    if (i !== index) {
                      goTo(i);
                      return;
                    }
                    onSelect(group.product);
                  }}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {groups.map((group, i) => (
          <button
            key={group.key}
            type="button"
            aria-label={`Ir para ${group.name}`}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index
                ? "w-7 bg-[var(--ink)]"
                : "w-1.5 bg-[var(--ink)]/25 hover:bg-[var(--ink)]/45"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
