import { hexFromColorName } from "@/lib/catalog/colors";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { getCurrentUser } from "@/lib/auth/session";
import { createCategory } from "@/lib/catalog/categories";
import type { Product, ProductCategory } from "@/types/database";

export type AdminProduct = Product & {
  category_id?: string | null;
  category_row?: Pick<ProductCategory, "id" | "name" | "slug"> | null;
};

export type ProductMutationResult =
  | { ok: true; product: AdminProduct }
  | { ok: false; error: string };

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function listAllProducts(): Promise<{
  products: AdminProduct[];
  error: string | null;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { products: [], error: "Somente admin." };
  }

  if (USE_MOCK_AUTH) {
    return {
      products: [
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
          description: "iPhone 17 no catálogo iPlanet Pay.",
          product_images: [],
          active: true,
          category: "iPhone",
          category_id: "cat-iphone",
        },
      ],
      error: null,
    };
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
        color_hex,
        list_price_cents,
        image_url,
        description,
        product_images,
        active,
        category,
        category_id,
        created_at,
        category_row:product_categories (
          id,
          name,
          slug
        )
      `,
      )
      .order("name", { ascending: true });

    if (error) return { products: [], error: error.message };
    return { products: (data ?? []) as unknown as AdminProduct[], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao carregar produtos";
    return { products: [], error: message };
  }
}

export type ProductInput = {
  id?: string;
  name: string;
  slug?: string;
  brand?: string;
  model: string;
  storage: string;
  color?: string | null;
  /** "#RRGGBB" já validado pela rota. */
  color_hex?: string | null;
  list_price_cents: number;
  image_url?: string | null;
  description?: string | null;
  product_images?: string[] | null;
  active?: boolean;
  category_id?: string | null;
  /** If set, create category (or reuse) then link */
  new_category_name?: string | null;
};

async function resolveCategoryId(
  categoryId: string | null | undefined,
  newCategoryName: string | null | undefined,
): Promise<{ category_id: string | null; category: string | null; error?: string }> {
  if (newCategoryName && newCategoryName.trim()) {
    const created = await createCategory(newCategoryName.trim());
    if (!created.ok) return { category_id: null, category: null, error: created.error };
    return { category_id: created.category.id, category: created.category.name };
  }
  if (categoryId) {
    return { category_id: categoryId, category: null };
  }
  return { category_id: null, category: null };
}

export async function createProduct(
  input: ProductInput,
): Promise<ProductMutationResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre para continuar." };
  if (user.role !== "admin") {
    return { ok: false, error: "Somente admin pode criar produtos." };
  }

  const name = input.name.trim();
  const model = input.model.trim();
  const storage = input.storage.trim();
  if (!name || !model || !storage) {
    return { ok: false, error: "Preencha nome, modelo e armazenamento." };
  }
  if (!Number.isFinite(input.list_price_cents) || input.list_price_cents <= 0) {
    return { ok: false, error: "Preço deve ser maior que zero (centavos)." };
  }

  const resolved = await resolveCategoryId(
    input.category_id,
    input.new_category_name,
  );
  if (resolved.error) return { ok: false, error: resolved.error };
  if (!resolved.category_id) {
    return { ok: false, error: "Selecione ou crie uma categoria." };
  }

  const slug =
    (input.slug?.trim() || slugify(`${name}-${storage}`)) || "produto";
  const brand = (input.brand?.trim() || "Apple").trim();
  const color = input.color?.trim() || null;
  const color_hex = color ? (input.color_hex ?? hexFromColorName(color)) : null;
  const image_url = input.image_url?.trim() || null;
  const description = input.description?.trim() || null;
  const product_images = input.product_images ?? [];
  const active = input.active ?? true;

  if (USE_MOCK_AUTH) {
    return {
      ok: true,
      product: {
        id: `mock-${slug}`,
        name,
        slug,
        brand,
        model,
        storage,
        color,
        color_hex,
        list_price_cents: input.list_price_cents,
        image_url,
        description,
        product_images,
        active,
        category: resolved.category ?? "Nova",
        category_id: resolved.category_id,
      },
    };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const row: Record<string, unknown> = {
      name,
      slug,
      brand,
      model,
      storage,
      color,
      color_hex,
      list_price_cents: Math.round(input.list_price_cents),
      image_url,
      description,
      product_images,
      active,
      category_id: resolved.category_id,
    };
    if (resolved.category) row.category = resolved.category;

    const { data, error } = await supabase
      .from("products")
      .insert(row)
      .select(
        `
        id, name, slug, brand, model, storage, color, color_hex,
        list_price_cents, image_url, description, product_images, active, category, category_id, created_at
      `,
      )
      .single();

    if (error) return { ok: false, error: error.message };

    // Infinite stock: link product to all stores with high qty (no stock UI)
    const { data: stores } = await supabase.from("stores").select("id");
    if (stores && stores.length > 0) {
      await supabase.from("store_stock").upsert(
        stores.map((s) => ({
          store_id: s.id,
          product_id: (data as Product).id,
          qty_available: 9999,
        })),
        { onConflict: "store_id,product_id" },
      );
    }

    return { ok: true, product: data as AdminProduct };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao criar produto";
    return { ok: false, error: message };
  }
}

export async function updateProduct(
  input: ProductInput & { id: string },
): Promise<ProductMutationResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre para continuar." };
  if (user.role !== "admin") {
    return { ok: false, error: "Somente admin pode editar produtos." };
  }
  if (!input.id) return { ok: false, error: "Produto inválido." };

  const name = input.name.trim();
  const model = input.model.trim();
  const storage = input.storage.trim();
  if (!name || !model || !storage) {
    return { ok: false, error: "Preencha nome, modelo e armazenamento." };
  }
  if (!Number.isFinite(input.list_price_cents) || input.list_price_cents <= 0) {
    return { ok: false, error: "Preço deve ser maior que zero (centavos)." };
  }

  const resolved = await resolveCategoryId(
    input.category_id,
    input.new_category_name,
  );
  if (resolved.error) return { ok: false, error: resolved.error };
  if (!resolved.category_id) {
    return { ok: false, error: "Selecione ou crie uma categoria." };
  }

  const slug =
    (input.slug?.trim() || slugify(`${name}-${storage}`)) || "produto";
  const brand = (input.brand?.trim() || "Apple").trim();
  const color = input.color?.trim() || null;
  const color_hex = color ? (input.color_hex ?? hexFromColorName(color)) : null;
  const image_url = input.image_url?.trim() || null;
  const description = input.description?.trim() || null;
  const product_images = input.product_images ?? [];
  const active = input.active ?? true;

  if (USE_MOCK_AUTH) {
    return {
      ok: true,
      product: {
        id: input.id,
        name,
        slug,
        brand,
        model,
        storage,
        color,
        color_hex,
        list_price_cents: input.list_price_cents,
        image_url,
        description,
        product_images,
        active,
        category: resolved.category ?? "Nova",
        category_id: resolved.category_id,
      },
    };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const row: Record<string, unknown> = {
      name,
      slug,
      brand,
      model,
      storage,
      color,
      color_hex,
      list_price_cents: Math.round(input.list_price_cents),
      image_url,
      description,
      product_images,
      active,
      category_id: resolved.category_id,
    };
    if (resolved.category) row.category = resolved.category;

    const { data, error } = await supabase
      .from("products")
      .update(row)
      .eq("id", input.id)
      .select(
        `
        id, name, slug, brand, model, storage, color, color_hex,
        list_price_cents, image_url, description, product_images, active, category, category_id, created_at
      `,
      )
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, product: data as AdminProduct };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao atualizar produto";
    return { ok: false, error: message };
  }
}
