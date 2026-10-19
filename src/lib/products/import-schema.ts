export type ProductColumnKey =
  | "id"
  | "nome"
  | "slug"
  | "categoria"
  | "marca"
  | "modelo"
  | "armazenamento"
  | "cor"
  | "preco"
  | "imagem_capa"
  | "imagens"
  | "descricao"
  | "ativo"
  | "variantes";

export type ProductColumn = {
  key: ProductColumnKey;
  required: boolean;
  description: string;
  example: string;
  width: number;
};

export const PRODUCT_COLUMNS: readonly ProductColumn[] = [
  {
    key: "id",
    required: false,
    description:
      "ID interno do produto. Preenchido na exportação; se informado, atualiza esse produto.",
    example: "",
    width: 38,
  },
  {
    key: "nome",
    required: true,
    description: "Nome exibido no catálogo.",
    example: "iPhone 17 Pro",
    width: 28,
  },
  {
    key: "slug",
    required: false,
    description:
      "Identificador na URL (letras minúsculas, números e hífen). Se vazio, é gerado a partir de nome + armazenamento. Produtos com o mesmo slug são atualizados.",
    example: "iphone-17-pro-256-gb",
    width: 28,
  },
  {
    key: "categoria",
    required: true,
    description: "Nome da categoria (aba do catálogo). Criada automaticamente se não existir.",
    example: "iPhone",
    width: 14,
  },
  {
    key: "marca",
    required: false,
    description: "Marca do produto. Padrão: Apple.",
    example: "Apple",
    width: 10,
  },
  {
    key: "modelo",
    required: true,
    description: "Modelo do aparelho.",
    example: "iPhone 17 Pro",
    width: 20,
  },
  {
    key: "armazenamento",
    required: true,
    description: "Capacidade de armazenamento.",
    example: "256 GB",
    width: 14,
  },
  {
    key: "cor",
    required: false,
    description: "Cor principal.",
    example: "Laranja-cósmico",
    width: 16,
  },
  {
    key: "preco",
    required: true,
    description:
      "Preço em reais, maior que zero. Aceita 9999,00 · 9.999,00 · 9999.00 · R$ 9.999,00.",
    example: "9999,00",
    width: 12,
  },
  {
    key: "imagem_capa",
    required: false,
    description: "URL da imagem de capa (https://… ou /products/…).",
    example: "/products/iphone-17-pro.png",
    width: 32,
  },
  {
    key: "imagens",
    required: false,
    description: "Imagens extras da galeria, separadas por |.",
    example: "/products/iphone-17-pro-2.png | /products/iphone-17-pro-3.png",
    width: 40,
  },
  {
    key: "descricao",
    required: false,
    description: "Texto de marketing exibido no modal do catálogo.",
    example: "Titânio, câmera tripla e bateria para o dia todo.",
    width: 40,
  },
  {
    key: "ativo",
    required: false,
    description: "sim ou não (também aceita true/false, 1/0). Padrão: sim.",
    example: "sim",
    width: 8,
  },
  {
    key: "variantes",
    required: false,
    description:
      "Variantes (SKU) separadas por |. Cada uma: modelo / cor / armazenamento / preço. Campos vazios são permitidos, mas o preço é obrigatório.",
    example: "iPhone 17 Pro / Azul / 256 GB / 9999,00 | iPhone 17 Pro / Azul / 512 GB / 11499,00",
    width: 60,
  },
];

export const PRODUCT_HEADERS: readonly ProductColumnKey[] = PRODUCT_COLUMNS.map((c) => c.key);

export const MAX_IMPORT_ROWS = 2000;

const HEADER_ALIASES: Record<string, ProductColumnKey> = {
  name: "nome",
  produto: "nome",
  category: "categoria",
  brand: "marca",
  model: "modelo",
  storage: "armazenamento",
  color: "cor",
  price: "preco",
  preco_reais: "preco",
  imagem: "imagem_capa",
  capa: "imagem_capa",
  image_url: "imagem_capa",
  product_images: "imagens",
  galeria: "imagens",
  description: "descricao",
  active: "ativo",
  variants: "variantes",
};

export type SheetCell = string | number | boolean | Date | null | undefined;

export type ProductVariantInput = {
  model: string | null;
  color: string | null;
  storage: string | null;
  price_cents: number;
};

/**
 * Optional fields left `undefined` were not informed (column absent, or blank
 * for marca/ativo/variantes): updates keep the stored value, creates use defaults.
 */
export type ProductImportValues = {
  id: string | null;
  name: string;
  slug: string;
  slugProvided: boolean;
  category: string;
  brand?: string;
  model: string;
  storage: string;
  color?: string | null;
  list_price_cents: number;
  image_url?: string | null;
  product_images?: string[];
  description?: string | null;
  active?: boolean;
  variants?: ProductVariantInput[];
};

export type ParsedProductRow = {
  line: number;
  label: string;
  values: ProductImportValues | null;
  errors: string[];
};

export type ProductSheetParse = {
  columns: ProductColumnKey[];
  missingColumns: ProductColumnKey[];
  unknownHeaders: string[];
  rows: ParsedProductRow[];
  error: string | null;
};

export type ExportableVariant = {
  model: string | null;
  color: string | null;
  storage: string | null;
  price_cents: number;
  active?: boolean;
};

export type ExportableProduct = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  model: string;
  storage: string;
  color: string | null;
  list_price_cents: number;
  image_url: string | null;
  description?: string | null;
  product_images?: string[] | null;
  active: boolean;
  category?: string | null;
  variants?: ExportableVariant[];
};

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function normalizeHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function headerToColumn(raw: string): ProductColumnKey | null {
  const key = normalizeHeader(raw);
  if ((PRODUCT_HEADERS as readonly string[]).includes(key)) return key as ProductColumnKey;
  return HEADER_ALIASES[key] ?? null;
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function cellText(cell: SheetCell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "string") {
    const trimmed = cell.trim();
    return trimmed.startsWith("'") && FORMULA_PREFIX.test(trimmed.slice(1))
      ? trimmed.slice(1)
      : trimmed;
  }
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
  if (typeof cell === "boolean") return cell ? "sim" : "não";
  return cell.toISOString();
}

/** Reais → cents. Comma is the pt-BR decimal mark; a dot followed by exactly 3 digits is a thousands separator. */
export function parsePriceCents(cell: SheetCell): number | null {
  if (typeof cell === "number") {
    if (!Number.isFinite(cell) || cell <= 0) return null;
    return Math.round(cell * 100);
  }
  const raw = cellText(cell)
    .replace(/^R\$/i, "")
    .replace(/[\s\u00a0]/g, "");
  if (!raw || !/^[0-9.,]+$/.test(raw)) return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let integer: string;
  let decimals = "";

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalAt = Math.max(lastComma, lastDot);
    const thousandsSep = decimalAt === lastComma ? "." : ",";
    const groups = raw.slice(0, decimalAt).split(thousandsSep);
    if (!/^\d{1,3}$/.test(groups[0]) || !groups.slice(1).every((g) => /^\d{3}$/.test(g))) {
      return null;
    }
    integer = groups.join("");
    decimals = raw.slice(decimalAt + 1);
  } else if (lastComma >= 0) {
    const parts = raw.split(",");
    if (parts.length !== 2) return null;
    [integer, decimals] = parts;
  } else if (lastDot >= 0) {
    const parts = raw.split(".");
    if (parts.length === 2 && parts[1].length !== 3) {
      [integer, decimals] = parts;
    } else if (/^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((p) => /^\d{3}$/.test(p))) {
      integer = parts.join("");
    } else {
      return null;
    }
  } else {
    integer = raw;
  }

  if (!/^\d+$/.test(integer) || !/^\d{0,2}$/.test(decimals)) return null;
  const cents = Number(integer) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function formatPriceForSheet(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return `${whole},${rest}`;
}

const TRUE_WORDS = new Set(["sim", "s", "true", "verdadeiro", "1", "ativo", "yes", "y", "x"]);
const FALSE_WORDS = new Set(["nao", "n", "false", "falso", "0", "inativo", "no"]);

export type BooleanCell = { kind: "empty" } | { kind: "value"; value: boolean } | { kind: "invalid" };

export function parseBooleanCell(cell: SheetCell): BooleanCell {
  if (typeof cell === "boolean") return { kind: "value", value: cell };
  const text = normalizeHeader(cellText(cell));
  if (!text) return { kind: "empty" };
  if (TRUE_WORDS.has(text)) return { kind: "value", value: true };
  if (FALSE_WORDS.has(text)) return { kind: "value", value: false };
  return { kind: "invalid" };
}

function isImageUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url) || /^\/\S*$/.test(url);
}

export function splitList(text: string): string[] {
  return text
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatImages(urls: readonly string[]): string {
  return urls.filter(Boolean).join(" | ");
}

export function variantKey(v: Pick<ProductVariantInput, "model" | "color" | "storage">): string {
  return [v.model, v.color, v.storage].map((x) => (x ?? "").trim().toLowerCase()).join("\u0000");
}

export function parseVariants(text: string): { variants: ProductVariantInput[]; errors: string[] } {
  const variants: ProductVariantInput[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  splitList(text).forEach((entry, index) => {
    const label = `Variante ${index + 1}`;
    const fields = entry.split("/").map((f) => f.trim());
    if (fields.length !== 4) {
      errors.push(`${label}: use "modelo / cor / armazenamento / preço" (${fields.length} campo(s) encontrado(s)).`);
      return;
    }
    const [model, color, storage, price] = fields;
    if (!model && !color && !storage) {
      errors.push(`${label}: informe ao menos modelo, cor ou armazenamento.`);
      return;
    }
    const price_cents = parsePriceCents(price);
    if (price_cents === null) {
      errors.push(`${label}: preço inválido "${price}".`);
      return;
    }
    const variant = {
      model: model || null,
      color: color || null,
      storage: storage || null,
      price_cents,
    };
    const key = variantKey(variant);
    if (seen.has(key)) {
      errors.push(`${label}: duplicada.`);
      return;
    }
    seen.add(key);
    variants.push(variant);
  });
  return { variants, errors };
}

export function formatVariants(variants: readonly ExportableVariant[]): string {
  return variants
    .map((v) =>
      [v.model ?? "", v.color ?? "", v.storage ?? "", formatPriceForSheet(v.price_cents)].join(" / "),
    )
    .join(" | ");
}

function isEmptyRow(row: readonly SheetCell[]): boolean {
  return row.every((cell) => cellText(cell) === "");
}

function parseRow(
  row: readonly SheetCell[],
  line: number,
  columnIndex: Map<ProductColumnKey, number>,
): ParsedProductRow {
  const errors: string[] = [];
  const has = (key: ProductColumnKey) => columnIndex.has(key);
  const raw = (key: ProductColumnKey): SheetCell => {
    const idx = columnIndex.get(key);
    return idx === undefined ? undefined : row[idx];
  };
  const text = (key: ProductColumnKey) => cellText(raw(key));

  const name = text("nome");
  const category = text("categoria");
  const model = text("modelo");
  const storage = text("armazenamento");
  if (!name) errors.push("nome é obrigatório.");
  else if (name.length > 200) errors.push("nome deve ter até 200 caracteres.");
  if (!category) errors.push("categoria é obrigatória.");
  if (!model) errors.push("modelo é obrigatório.");
  if (!storage) errors.push("armazenamento é obrigatório.");

  const priceRaw = raw("preco");
  const list_price_cents = parsePriceCents(priceRaw);
  if (list_price_cents === null) {
    errors.push(
      cellText(priceRaw)
        ? `preco inválido "${cellText(priceRaw)}" (use 9999,00).`
        : "preco é obrigatório.",
    );
  }

  const slugText = text("slug");
  const slug = slugify(slugText || `${name}-${storage}`) || "produto";

  const values: ProductImportValues = {
    id: text("id") || null,
    name,
    slug,
    slugProvided: Boolean(slugText),
    category,
    model,
    storage,
    list_price_cents: list_price_cents ?? 0,
  };

  const brand = text("marca");
  if (brand) values.brand = brand;
  if (has("cor")) values.color = text("cor") || null;
  if (has("descricao")) values.description = text("descricao") || null;

  if (has("imagem_capa")) {
    const cover = text("imagem_capa");
    if (cover && !isImageUrl(cover)) errors.push(`imagem_capa inválida "${cover}".`);
    values.image_url = cover || null;
  }
  if (has("imagens")) {
    const urls = splitList(text("imagens"));
    const invalid = urls.filter((u) => !isImageUrl(u));
    if (invalid.length) errors.push(`imagens inválidas: ${invalid.join(", ")}.`);
    values.product_images = urls.filter((u, i) => urls.indexOf(u) === i && u !== values.image_url);
  }

  const active = parseBooleanCell(raw("ativo"));
  switch (active.kind) {
    case "empty":
      break;
    case "value":
      values.active = active.value;
      break;
    case "invalid":
      errors.push(`ativo inválido "${text("ativo")}" (use sim ou não).`);
      break;
    default: {
      const unreachable: never = active;
      throw new Error(`Valor inesperado: ${JSON.stringify(unreachable)}`);
    }
  }

  const variantsText = text("variantes");
  if (variantsText) {
    const parsed = parseVariants(variantsText);
    errors.push(...parsed.errors);
    values.variants = parsed.variants;
  }

  return { line, label: name || text("slug"), values: errors.length ? null : values, errors };
}

export function parseProductTable(table: readonly (readonly SheetCell[])[]): ProductSheetParse {
  const result: ProductSheetParse = {
    columns: [],
    missingColumns: [],
    unknownHeaders: [],
    rows: [],
    error: null,
  };

  const headerAt = table.findIndex((row) => !isEmptyRow(row));
  if (headerAt < 0) {
    result.error = "Arquivo vazio.";
    return result;
  }

  const columnIndex = new Map<ProductColumnKey, number>();
  table[headerAt].forEach((cell, idx) => {
    const header = cellText(cell);
    if (!header) return;
    const key = headerToColumn(header);
    if (!key) {
      result.unknownHeaders.push(header);
      return;
    }
    if (columnIndex.has(key)) {
      result.error = `Coluna "${key}" aparece mais de uma vez.`;
      return;
    }
    columnIndex.set(key, idx);
  });
  if (result.error) return result;

  result.columns = PRODUCT_HEADERS.filter((key) => columnIndex.has(key));
  result.missingColumns = PRODUCT_COLUMNS.filter((c) => c.required && !columnIndex.has(c.key)).map(
    (c) => c.key,
  );
  if (result.missingColumns.length) {
    result.error = `Colunas obrigatórias ausentes: ${result.missingColumns.join(", ")}.`;
    return result;
  }

  const body = table.slice(headerAt + 1);
  const dataRows = body.filter((row) => !isEmptyRow(row)).length;
  if (dataRows === 0) {
    result.error = "Nenhuma linha de produto encontrada.";
    return result;
  }
  if (dataRows > MAX_IMPORT_ROWS) {
    result.error = `Limite de ${MAX_IMPORT_ROWS} produtos por arquivo.`;
    return result;
  }

  const slugLines = new Map<string, number>();
  const idLines = new Map<string, number>();
  body.forEach((row, offset) => {
    if (isEmptyRow(row)) return;
    const line = headerAt + offset + 2;
    const parsed = parseRow(row, line, columnIndex);
    if (parsed.values) {
      const { slug, id } = parsed.values;
      const slugLine = slugLines.get(slug);
      if (slugLine !== undefined) parsed.errors.push(`slug "${slug}" repetido (linha ${slugLine}).`);
      else slugLines.set(slug, line);
      if (id) {
        const idLine = idLines.get(id);
        if (idLine !== undefined) parsed.errors.push(`id repetido (linha ${idLine}).`);
        else idLines.set(id, line);
      }
      if (parsed.errors.length) parsed.values = null;
    }
    result.rows.push(parsed);
  });

  return result;
}

export type ImportAction = "create" | "update" | "error";

export type ImportPlanRow = {
  line: number;
  label: string;
  action: ImportAction;
  productId: string | null;
  values: ProductImportValues | null;
  errors: string[];
};

export type ExistingProductRef = { id: string; slug: string };

export function planImport(
  rows: readonly ParsedProductRow[],
  existing: readonly ExistingProductRef[],
): ImportPlanRow[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  return rows.map((row): ImportPlanRow => {
    const fail = (errors: string[], values: ProductImportValues | null = null): ImportPlanRow => ({
      line: row.line,
      label: row.label,
      action: "error",
      productId: null,
      values,
      errors,
    });
    if (!row.values) return fail(row.errors);
    const values = row.values;
    if (values.id) {
      const target = byId.get(values.id);
      if (!target) {
        return fail([`id "${values.id}" não encontrado. Deixe vazio para criar um produto novo.`], values);
      }
      const slug = values.slugProvided ? values.slug : target.slug;
      const owner = bySlug.get(slug);
      if (owner && owner.id !== target.id) {
        return fail([`slug "${slug}" já pertence a outro produto.`], values);
      }
      return {
        line: row.line,
        label: row.label,
        action: "update",
        productId: target.id,
        values: { ...values, slug },
        errors: [],
      };
    }
    const match = bySlug.get(values.slug);
    return {
      line: row.line,
      label: row.label,
      action: match ? "update" : "create",
      productId: match?.id ?? null,
      values,
      errors: [],
    };
  });
}

export type ImportSummary = Record<ImportAction, number>;

export function summarizePlan(plan: readonly ImportPlanRow[]): ImportSummary {
  const summary = { create: 0, update: 0, error: 0 };
  for (const row of plan) summary[row.action] += 1;
  return summary;
}

export type ImportPreviewRow = {
  line: number;
  action: ImportAction;
  name: string;
  slug: string;
  category: string;
  price_cents: number;
  variants: number;
  errors: string[];
};

export type ImportApplyResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  variantsCreated: number;
  variantsUpdated: number;
  failures: Array<{ line: number; error: string }>;
};

export type ImportResponse =
  | {
      ok: true;
      mode: "preview" | "apply";
      mock: boolean;
      fileName: string;
      columns: ProductColumnKey[];
      unknownHeaders: string[];
      summary: ImportSummary;
      rows: ImportPreviewRow[];
      result: ImportApplyResult | null;
    }
  | { ok: false; error: string };

export function previewRows(plan: readonly ImportPlanRow[]): ImportPreviewRow[] {
  return plan.map((row) => ({
    line: row.line,
    action: row.action,
    name: row.values?.name ?? row.label,
    slug: row.values?.slug ?? "",
    category: row.values?.category ?? "",
    price_cents: row.values?.list_price_cents ?? 0,
    variants: row.values?.variants?.length ?? 0,
    errors: row.errors,
  }));
}

export function productsToTable(products: readonly ExportableProduct[]): string[][] {
  const rows = products.map((p) => {
    const record: Record<ProductColumnKey, string> = {
      id: p.id,
      nome: p.name,
      slug: p.slug,
      categoria: p.category ?? "",
      marca: p.brand,
      modelo: p.model,
      armazenamento: p.storage,
      cor: p.color ?? "",
      preco: formatPriceForSheet(p.list_price_cents),
      imagem_capa: p.image_url ?? "",
      imagens: formatImages(p.product_images ?? []),
      descricao: p.description ?? "",
      ativo: p.active ? "sim" : "não",
      variantes: formatVariants((p.variants ?? []).filter((v) => v.active !== false)),
    };
    return PRODUCT_HEADERS.map((key) => record[key]);
  });
  return [[...PRODUCT_HEADERS], ...rows];
}

export function templateTable(): string[][] {
  return productsToTable([
    {
      id: "",
      name: "iPhone 17 Pro",
      slug: "iphone-17-pro-256-gb",
      brand: "Apple",
      model: "iPhone 17 Pro",
      storage: "256 GB",
      color: "Laranja-cósmico",
      list_price_cents: 999900,
      image_url: "/products/iphone-17-pro.png",
      product_images: [],
      description: "Titânio, câmera tripla e bateria para o dia todo.",
      active: true,
      category: "iPhone",
      variants: [
        { model: "iPhone 17 Pro", color: "Azul", storage: "256 GB", price_cents: 999900 },
        { model: "iPhone 17 Pro", color: "Azul", storage: "512 GB", price_cents: 1149900 },
      ],
    },
    {
      id: "",
      name: "AirPods Pro 3",
      slug: "",
      brand: "Apple",
      model: "AirPods Pro 3",
      storage: "—",
      color: null,
      list_price_cents: 249900,
      image_url: null,
      product_images: [],
      description: null,
      active: false,
      category: "AirPods",
    },
  ]);
}

function detectDelimiter(text: string): string {
  const counts = new Map<string, number>([
    [";", 0],
    [",", 0],
    ["\t", 0],
  ]);
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && counts.has(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let best = ";";
  let bestCount = 0;
  for (const [delimiter, count] of counts) {
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180 CSV with `;`, `,` or tab detected from the header line. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvField(value: string, delimiter: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /["\r\n]/.test(safe) || safe.includes(delimiter) || safe !== safe.trim()
    ? `"${safe.replace(/"/g, '""')}"`
    : safe;
}

export function toCsv(table: readonly (readonly string[])[], delimiter = ";"): string {
  return table.map((row) => row.map((cell) => csvField(cell, delimiter)).join(delimiter)).join("\r\n");
}

export type ProductTransferFormat = "csv" | "xlsx";

export function isTransferFormat(value: string): value is ProductTransferFormat {
  return value === "csv" || value === "xlsx";
}

export function transferFormatFromName(fileName: string): ProductTransferFormat | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return isTransferFormat(ext) ? ext : null;
}
