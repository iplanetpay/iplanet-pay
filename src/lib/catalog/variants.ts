/**
 * Variantes do catálogo (Cor e Armazenamento).
 * O produto em si é a variante base (id null, preço de lista); as linhas ativas de
 * product_variants somam outras combinações, cada uma com o próprio preço.
 * Lógica pura: usada no catálogo, no simulador e nos testes.
 */

export interface VariantRow {
  id: string;
  product_id: string;
  color: string | null;
  storage: string | null;
  price_cents: number;
}

export interface CatalogVariant {
  /** null = o próprio produto (sem variante). */
  id: string | null;
  color: string | null;
  storage: string | null;
  priceCents: number;
}

export interface VariantOptions {
  variants: CatalogVariant[];
  colors: string[];
  storages: string[];
}

const clean = (v: string | null | undefined) => {
  const t = String(v ?? "").trim();
  return t ? t : null;
};
const same = (a: string | null, b: string | null) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

/** "128 GB" < "512 GB" < "1 TB". Sem número fica no fim. */
export function storageRank(storage: string): number {
  const m = /([\d.,]+)\s*(tb|gb)/i.exec(storage);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = Number(m[1].replace(",", "."));
  return m[2].toLowerCase() === "tb" ? n * 1024 : n;
}

export function buildVariantOptions(
  product: { color: string | null; storage: string | null; list_price_cents: number },
  rows: VariantRow[] = [],
): VariantOptions {
  const variants: CatalogVariant[] = [
    { id: null, color: clean(product.color), storage: clean(product.storage), priceCents: product.list_price_cents },
  ];
  for (const row of rows) {
    if (!(row.price_cents > 0)) continue;
    const v: CatalogVariant = { id: row.id, color: clean(row.color), storage: clean(row.storage), priceCents: row.price_cents };
    // linha só com cor ou só com armazenamento herda o outro eixo do produto
    v.color ??= variants[0].color;
    v.storage ??= variants[0].storage;
    if (variants.some((x) => same(x.color, v.color) && same(x.storage, v.storage))) continue;
    variants.push(v);
  }
  const colors: string[] = [];
  const storages: string[] = [];
  for (const v of variants) {
    if (v.color && !colors.some((c) => same(c, v.color))) colors.push(v.color);
    if (v.storage && !storages.some((s) => same(s, v.storage))) storages.push(v.storage);
  }
  storages.sort((a, b) => storageRank(a) - storageRank(b));
  return { variants, colors, storages };
}

export function findVariant(opts: VariantOptions, color: string | null, storage: string | null): CatalogVariant | null {
  return opts.variants.find((v) => same(v.color, color) && same(v.storage, storage)) ?? null;
}

export function isComboAvailable(opts: VariantOptions, color: string | null, storage: string | null): boolean {
  return findVariant(opts, color, storage) !== null;
}

/** Troca de cor: mantém o armazenamento se existir nessa cor; senão o menor disponível. */
export function selectColor(opts: VariantOptions, current: CatalogVariant, color: string): CatalogVariant {
  return (
    findVariant(opts, color, current.storage) ??
    opts.variants.filter((v) => same(v.color, color)).sort((a, b) => storageRank(a.storage ?? "") - storageRank(b.storage ?? ""))[0] ??
    current
  );
}

/** Troca de armazenamento: só combinações existentes (as outras ficam desabilitadas). */
export function selectStorage(opts: VariantOptions, current: CatalogVariant, storage: string): CatalogVariant {
  return findVariant(opts, current.color, storage) ?? current;
}

export function minPriceCents(opts: VariantOptions): number {
  return Math.min(...opts.variants.map((v) => v.priceCents));
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Fotos com a cor escolhida no nome do arquivo vêm primeiro. */
export function imagesForColor(images: string[], color: string | null): string[] {
  if (!color) return images;
  const key = slug(color);
  if (!key) return images;
  const match = images.filter((url) => slug(decodeURIComponent(url.split("/").pop() ?? "")).includes(key));
  return match.length ? [...match, ...images.filter((u) => !match.includes(u))] : images;
}

export function variantLabel(v: Pick<CatalogVariant, "color" | "storage">): string {
  return [v.storage, v.color].filter(Boolean).join(" · ");
}

/**
 * Opções do simulador: uma por combinação (produto · armazenamento · cor), com o preço dela.
 * key = "produtoId:varianteId" (varianteId vazio = o próprio produto).
 */
export function simulatorOptions(
  products: Array<{ id: string; name: string; color: string | null; storage: string | null; list_price_cents: number }>,
  rows: Record<string, VariantRow[]>,
): Array<{ id: string; key: string; variantId: string | null; name: string; listPriceCents: number }> {
  return products.flatMap((product) => {
    const opts = buildVariantOptions(product, rows[product.id] ?? []);
    const many = opts.variants.length > 1;
    return opts.variants.map((v) => ({
      id: product.id,
      key: `${product.id}:${v.id ?? ""}`,
      variantId: v.id,
      name: many ? `${product.name} · ${variantLabel(v)}` : product.name,
      listPriceCents: v.priceCents,
    }));
  });
}
