import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import {
  createProduct,
  listAllProducts,
  updateProduct,
  type AdminProduct,
  type ProductInput,
} from "@/lib/catalog/admin-products";
import { createCategory, listCategoriesAdmin } from "@/lib/catalog/categories";
import {
  PRODUCT_COLUMNS,
  cellText,
  parseCsv,
  parseProductTable,
  planImport,
  previewRows,
  productsToTable,
  summarizePlan,
  templateTable,
  toCsv,
  transferFormatFromName,
  variantKey,
  type ExportableProduct,
  type ExportableVariant,
  type ImportApplyResult,
  type ImportPlanRow,
  type ImportResponse,
  type ProductImportValues,
  type ProductTransferFormat,
  type ProductVariantInput,
  type SheetCell,
} from "@/lib/products/import-schema";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

type VariantRow = ExportableVariant & { id: string; product_id: string };

async function variantsClient() {
  return tryCreateServiceClient() ?? (await createClient());
}

async function loadVariants(productIds: string[]): Promise<Map<string, VariantRow[]>> {
  const byProduct = new Map<string, VariantRow[]>();
  if (USE_MOCK_AUTH || productIds.length === 0) return byProduct;
  const client = await variantsClient();
  const { data, error } = await client
    .from("product_variants")
    .select("id, product_id, model, color, storage, price_cents, active")
    .in("product_id", productIds)
    .order("created_at");
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as VariantRow[]) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push(row);
    byProduct.set(row.product_id, list);
  }
  return byProduct;
}

function toExportable(p: AdminProduct, variants: ExportableVariant[]): ExportableProduct {
  return {
    ...p,
    category: p.category_row?.name ?? p.category ?? null,
    variants,
  };
}

export type ExportFile = { body: Uint8Array | string; contentType: string; fileName: string };

export async function buildProductsFile(
  format: ProductTransferFormat,
  template: boolean,
): Promise<{ ok: true; file: ExportFile } | { ok: false; error: string }> {
  let table: string[][];
  if (template) {
    table = templateTable();
  } else {
    const { products, error } = await listAllProducts();
    if (error) return { ok: false, error };
    try {
      const variants = await loadVariants(products.map((p) => p.id));
      table = productsToTable(products.map((p) => toExportable(p, variants.get(p.id) ?? [])));
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Falha ao carregar variantes." };
    }
  }

  const base = template ? "modelo-importacao-produtos" : `produtos-${new Date().toISOString().slice(0, 10)}`;
  switch (format) {
    case "csv":
      return {
        ok: true,
        file: {
          body: `\uFEFF${toCsv(table)}\r\n`,
          contentType: "text/csv; charset=utf-8",
          fileName: `${base}.csv`,
        },
      };
    case "xlsx": {
      const [header, ...rows] = table;
      const buffer = await writeXlsxFile(
        [header.map((value) => ({ value, fontWeight: "bold" as const })), ...rows],
        {
          sheet: "Produtos",
          stickyRowsCount: 1,
          columns: PRODUCT_COLUMNS.map((c) => ({ width: c.width })),
        },
      ).toBuffer();
      return {
        ok: true,
        file: {
          body: new Uint8Array(buffer),
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileName: `${base}.xlsx`,
        },
      };
    }
    default: {
      const unreachable: never = format;
      return { ok: false, error: `Formato desconhecido: ${String(unreachable)}` };
    }
  }
}

function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function readTable(file: File): Promise<{ table: SheetCell[][] } | { error: string }> {
  const format = transferFormatFromName(file.name);
  if (!format) return { error: "Envie um arquivo .xlsx ou .csv." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "Arquivo maior que 5 MB." };
  const bytes = await file.arrayBuffer();
  switch (format) {
    case "csv":
      return { table: parseCsv(decodeCsv(bytes)) };
    case "xlsx":
      try {
        const rows = await readSheet(Buffer.from(bytes));
        return { table: rows as unknown as SheetCell[][] };
      } catch {
        return { error: "Não foi possível ler o XLSX. Salve novamente no Excel/Sheets como .xlsx." };
      }
    default: {
      const unreachable: never = format;
      return { error: `Formato desconhecido: ${String(unreachable)}` };
    }
  }
}

function categoryKey(name: string) {
  return cellText(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function mergeInput(values: ProductImportValues, existing: AdminProduct | undefined, categoryId: string): ProductInput {
  return {
    name: values.name,
    slug: values.slug,
    brand: values.brand ?? existing?.brand,
    model: values.model,
    storage: values.storage,
    color: values.color !== undefined ? values.color : (existing?.color ?? null),
    list_price_cents: values.list_price_cents,
    image_url: values.image_url !== undefined ? values.image_url : (existing?.image_url ?? null),
    product_images: values.product_images ?? existing?.product_images ?? [],
    description: values.description !== undefined ? values.description : (existing?.description ?? null),
    active: values.active ?? existing?.active ?? true,
    category_id: categoryId,
  };
}

async function upsertVariants(
  productId: string,
  variants: ProductVariantInput[],
  current: VariantRow[],
): Promise<{ created: number; updated: number; error?: string }> {
  const counts = { created: 0, updated: 0 };
  if (USE_MOCK_AUTH) return { created: variants.length, updated: 0 };
  const client = await variantsClient();
  const byKey = new Map(current.map((v) => [variantKey(v), v]));
  for (const variant of variants) {
    const match = byKey.get(variantKey(variant));
    if (match) {
      if (match.price_cents === variant.price_cents && match.active !== false) continue;
      const { error } = await client
        .from("product_variants")
        .update({ price_cents: variant.price_cents, active: true })
        .eq("id", match.id);
      if (error) return { ...counts, error: error.message };
      counts.updated += 1;
    } else {
      const { error } = await client
        .from("product_variants")
        .insert({ product_id: productId, ...variant, active: true });
      if (error) return { ...counts, error: error.message };
      counts.created += 1;
    }
  }
  return counts;
}

async function applyPlan(plan: ImportPlanRow[], products: AdminProduct[]): Promise<ImportApplyResult> {
  const result: ImportApplyResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    failures: [],
  };
  const fail = (line: number, error: string) => {
    result.failed += 1;
    result.failures.push({ line, error });
  };

  const { categories, error: catError } = await listCategoriesAdmin();
  if (catError) throw new Error(catError);
  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    categoryIds.set(categoryKey(c.name), c.id);
    categoryIds.set(categoryKey(c.slug), c.id);
  }
  const productsById = new Map(products.map((p) => [p.id, p]));
  const touched = plan.flatMap((row) => (row.productId && row.values?.variants ? [row.productId] : []));
  const variantsByProduct = await loadVariants(touched);

  for (const row of plan) {
    if (row.action === "error" || !row.values) {
      result.skipped += 1;
      continue;
    }
    const values = row.values;

    let categoryId = categoryIds.get(categoryKey(values.category));
    if (!categoryId) {
      const created = await createCategory(values.category);
      if (!created.ok) {
        fail(row.line, created.error);
        continue;
      }
      categoryId = created.category.id;
      categoryIds.set(categoryKey(values.category), categoryId);
    }

    const existing = row.productId ? productsById.get(row.productId) : undefined;
    const input = mergeInput(values, existing, categoryId);
    const saved =
      row.action === "update" && row.productId
        ? await updateProduct({ ...input, id: row.productId })
        : await createProduct(input);
    if (!saved.ok) {
      fail(row.line, saved.error);
      continue;
    }
    if (row.action === "update") result.updated += 1;
    else result.created += 1;

    if (values.variants?.length) {
      const variants = await upsertVariants(
        saved.product.id,
        values.variants,
        variantsByProduct.get(saved.product.id) ?? [],
      );
      result.variantsCreated += variants.created;
      result.variantsUpdated += variants.updated;
      if (variants.error) fail(row.line, `Variantes: ${variants.error}`);
    }
  }
  return result;
}

export async function importProductsFile(file: File, apply: boolean): Promise<ImportResponse> {
  const read = await readTable(file);
  if ("error" in read) return { ok: false, error: read.error };

  const parsed = parseProductTable(read.table);
  if (parsed.error) return { ok: false, error: parsed.error };

  const { products, error } = await listAllProducts();
  if (error) return { ok: false, error };
  const plan = planImport(parsed.rows, products);

  let result: ImportApplyResult | null = null;
  if (apply) {
    try {
      result = await applyPlan(plan, products);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Falha ao importar." };
    }
  }

  return {
    ok: true,
    mode: apply ? "apply" : "preview",
    mock: USE_MOCK_AUTH,
    fileName: file.name,
    columns: parsed.columns,
    unknownHeaders: parsed.unknownHeaders,
    summary: summarizePlan(plan),
    rows: previewRows(plan),
    result,
  };
}
