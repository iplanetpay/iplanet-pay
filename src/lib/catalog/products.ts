import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import type { ProductWithStock } from "@/types/database";
import { normalizeStoreEmbed } from "./stores-for-product";

export { storesForProduct, normalizeStoreEmbed } from "./stores-for-product";
export type { StoreStockRow } from "./stores-for-product";

export const MOCK_CATALOG: ProductWithStock[] = [
  {
    id: "mock-iphone-17",
    name: "iPhone 17",
    slug: "iphone-17-256",
    brand: "Apple",
    model: "iPhone 17",
    storage: "256 GB",
    color: "Lavanda",
    list_price_cents: 799900,
    image_url: "/products/iphone-17.png",
    description:
      "iPhone 17 no catálogo iPlanet Pay: reserve e aporte via Pix no seu ritmo. Retire nas lojas Itaim Bibi ou São Caetano.",
    product_images: [],
    active: true,
    category: "iPhone",
    category_id: "cat-iphone",
    store_stock: [
      {
        qty_available: 9999,
        store: {
          id: "store-itaim",
          name: "iPlanet Itaim Bibi",
          slug: "itaim-bibi",
        },
      },
      {
        qty_available: 9999,
        store: {
          id: "store-sc",
          name: "iPlanet São Caetano",
          slug: "sao-caetano",
        },
      },
    ],
  },
];

function normalizeCatalogProducts(rows: ProductWithStock[]): ProductWithStock[] {
  return rows.map((p) => ({
    ...p,
    store_stock: Array.isArray(p.store_stock)
      ? p.store_stock.map((row) => ({
          qty_available: row?.qty_available ?? 0,
          store: normalizeStoreEmbed(
            row?.store as Parameters<typeof normalizeStoreEmbed>[0],
          ),
        }))
      : [],
  }));
}

export async function listCatalogProducts(): Promise<{
  products: ProductWithStock[];
  error: string | null;
}> {
  if (USE_MOCK_AUTH) {
    return { products: MOCK_CATALOG, error: null };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        slug,
        brand,
        model,
        storage,
        color,
        list_price_cents,
        image_url,
        description,
        product_images,
        active,
        category,
        category_id,
        store_stock (
          qty_available,
          store:stores (
            id,
            name,
            slug
          )
        )
      `,
      )
      .eq("active", true)
      .order("list_price_cents", { ascending: true });

    if (error) {
      return { products: [], error: error.message };
    }

    return {
      products: normalizeCatalogProducts(
        (data ?? []) as unknown as ProductWithStock[],
      ),
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao carregar catálogo";
    return { products: [], error: message };
  }
}

export async function listProductSwatches(): Promise<Record<string, string[]>> {
  if (USE_MOCK_AUTH) return {};
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_variants")
      .select("product_id, color")
      .eq("active", true);
    if (error || !data) return {};
    const map: Record<string, string[]> = {};
    for (const row of data) {
      const color = String(row.color ?? "").trim();
      if (!color) continue;
      const list = map[row.product_id] ?? [];
      if (!list.includes(color)) list.push(color);
      map[row.product_id] = list;
    }
    return map;
  } catch {
    return {};
  }
}

export async function getProductBySlug(slug: string) {
  const { products, error } = await listCatalogProducts();
  if (error) return { product: null, error };
  return {
    product: products.find((p) => p.slug === slug) ?? null,
    error: null,
  };
}
