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

export function CatalogBrowser({
  products,
  swatches,
  highlightId,
}: {
  products: ProductWithStock[];
  swatches: Record<string, string[]>;
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
          {visible.map((product) => {
            const colors = [
              ...(product.color ? [product.color] : []),
              ...((swatches[product.id] ?? []).filter((color) => color !== product.color)),
            ];
            return (
              <Card
                key={product.id}
                id={product.slug}
                className={highlightId === product.id ? "ring-2 ring-[var(--accent)]" : ""}
              >
                <CatalogProductCard
                  name={product.name}
                  meta={
                    [product.storage, colors.length === 1 ? "1 cor" : `${Math.max(colors.length, 1)} cores`]
                      .filter(Boolean)
                      .join(" · ")
                  }
                  condition={conditionFromName(product.name, product.category)}
                  priceCents={product.list_price_cents}
                  images={[product.image_url, ...(product.product_images ?? [])].filter(
                    (url): url is string => Boolean(url),
                  )}
                  colors={colors}
                  onDetails={() => {
                    document.getElementById(`reserve-${product.id}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                    });
                  }}
                />
                <div id={`reserve-${product.id}`} className="mt-4">
                  <ReserveForm product={product} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
