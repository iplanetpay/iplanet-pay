"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReserveForm } from "@/components/reservations/reserve-form";
import {
  CatalogProductCard,
  conditionFromName,
} from "@/components/catalog/catalog-product-card";
import type { ProductWithStock } from "@/types/database";
import Link from "next/link";
import { CatalogVariantPicker } from "@/components/catalog/catalog-variant-picker";
import {
  buildVariantOptions,
  imagesForColor,
  minPriceCents,
  variantLabel,
  type CatalogVariant,
  type VariantRow,
} from "@/lib/catalog/variants";

export function CatalogBrowser({
  products,
  swatches,
  variants = {},
  highlightId,
}: {
  products: ProductWithStock[];
  swatches: Record<string, string[]>;
  variants?: Record<string, VariantRow[]>;
  highlightId?: string | null;
}) {
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const product of products) {
      if (product.category) names.add(product.category);
    }
    return ["Todos", ...names];
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const inCategory = category === "Todos" || product.category === category;
      const inName =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.model.toLowerCase().includes(q);
      return inCategory && inName;
    });
  }, [products, category, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              className={
                category === name
                  ? "shrink-0 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white"
                  : "shrink-0 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink-muted)]"
              }
            >
              {name}
            </button>
          ))}
        </div>
        {searchOpen ? (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pelo nome"
            className="h-10 w-full rounded-full border border-[var(--line)] px-4 text-sm outline-none sm:w-56"
          />
        ) : null}
        <button
          type="button"
          aria-label="Pesquisar produto"
          onClick={() => setSearchOpen((open) => !open)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">Nenhum produto com esse nome.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((product) => (
            <CatalogItem
              key={product.id}
              product={product}
              swatches={swatches[product.id] ?? []}
              rows={variants[product.id] ?? []}
              highlighted={highlightId === product.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogItem({
  product,
  swatches,
  rows,
  highlighted,
}: {
  product: ProductWithStock;
  swatches: string[];
  rows: VariantRow[];
  highlighted: boolean;
}) {
  const options = useMemo(() => buildVariantOptions(product, rows), [product, rows]);
  const [variant, setVariant] = useState<CatalogVariant>(options.variants[0]);
  const hasChoice = options.variants.length > 1;
  // sem variantes cadastradas, as cores extras (swatches) continuam só ilustrativas
  const colors = hasChoice
    ? options.colors
    : [...(product.color ? [product.color] : []), ...swatches.filter((c) => c !== product.color)];
  const images = imagesForColor(
    [product.image_url, ...(product.product_images ?? [])].filter((url): url is string => Boolean(url)),
    variant.color,
  );
  const simulatorHref = `/app/simulador?product=${encodeURIComponent(product.id)}${variant.id ? `&variant=${encodeURIComponent(variant.id)}` : ""}`;

  return (
    <Card id={product.slug} className={highlighted ? "ring-2 ring-[var(--accent)]" : ""}>
      <CatalogProductCard
        name={product.name}
        meta={
          hasChoice
            ? variantLabel(variant)
            : [product.storage, colors.length === 1 ? "1 cor" : `${Math.max(colors.length, 1)} cores`].filter(Boolean).join(" · ")
        }
        condition={conditionFromName(product.name, product.category)}
        priceCents={hasChoice ? variant.priceCents : minPriceCents(options)}
        exactPrice={hasChoice}
        images={images}
        colors={colors}
        picker={hasChoice ? <CatalogVariantPicker options={options} value={variant} onChange={setVariant} /> : undefined}
        onDetails={() => {
          document.getElementById(`reserve-${product.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }}
      />
      <div id={`reserve-${product.id}`} className="mt-4">
        <ReserveForm product={product} variant={hasChoice ? variant : null} />
        <Link
          href={simulatorHref}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Simular aportes{hasChoice ? ` · ${variantLabel(variant)}` : ""}
        </Link>
      </div>
    </Card>
  );
}
