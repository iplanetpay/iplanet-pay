import assert from "node:assert/strict";
import {
  PRODUCT_COLUMNS,
  PRODUCT_HEADERS,
  formatPriceForSheet,
  parseBooleanCell,
  parseCsv,
  parsePriceCents,
  parseProductTable,
  parseVariants,
  planImport,
  productsToTable,
  summarizePlan,
  templateTable,
  toCsv,
  transferFormatFromName,
} from "../../src/lib/products/import-schema.ts";

const product = {
  id: "11111111-1111-4111-8111-111111111111",
  name: 'iPhone 17 "Pro"; edição',
  slug: "iphone-17-pro-256",
  brand: "Apple",
  model: "iPhone 17 Pro",
  storage: "256 GB",
  color: "Azul",
  list_price_cents: 999990,
  image_url: "/products/iphone-17-pro.png",
  product_images: ["https://cdn.example.com/a.png", "/products/b.png"],
  description: "Linha 1\nLinha 2, com vírgula",
  active: false,
  category: "iPhone",
  variants: [
    { model: "iPhone 17 Pro", color: "Azul", storage: "256 GB", price_cents: 999990, active: true },
    { model: "iPhone 17 Pro", color: null, storage: "512 GB", price_cents: 1149900, active: true },
    { model: "Velha", color: null, storage: null, price_cents: 100, active: false },
  ],
};

export default function suite(test) {
  test("products import: CSV parsing handles quotes, semicolons, escaped quotes and newlines", () => {
    const csv = '\uFEFFnome;descricao;preco\r\n"iPhone; 17";"Diz ""olá""\nnova linha";"7.999,00"\r\n\r\nMac;;10\n';
    assert.deepEqual(parseCsv(csv), [
      ["nome", "descricao", "preco"],
      ["iPhone; 17", 'Diz "olá"\nnova linha', "7.999,00"],
      [""],
      ["Mac", "", "10"],
    ]);
    assert.deepEqual(parseCsv('nome,preco\n"a,b","1.234,56"'), [
      ["nome", "preco"],
      ["a,b", "1.234,56"],
    ]);
    assert.deepEqual(parseCsv("nome\tpreco\nx\t1"), [
      ["nome", "preco"],
      ["x", "1"],
    ]);
  });

  test("products import: prices in reais accept comma, dot and thousands separators", () => {
    assert.equal(parsePriceCents("7999,00"), 799900);
    assert.equal(parsePriceCents("7.999,00"), 799900);
    assert.equal(parsePriceCents("7999.00"), 799900);
    assert.equal(parsePriceCents("7,999.50"), 799950);
    assert.equal(parsePriceCents("R$ 7.999,9"), 799990);
    assert.equal(parsePriceCents("7.999"), 799900);
    assert.equal(parsePriceCents("1.234.567"), 123456700);
    assert.equal(parsePriceCents("7999"), 799900);
    assert.equal(parsePriceCents("0,5"), 50);
    assert.equal(parsePriceCents(7999.5), 799950);
    assert.equal(parsePriceCents(0.1 + 0.2), 30);
    for (const bad of ["", "abc", "0", "0,00", "-10", "7999,123", "1,2,3", "79.99.00", "7.99,00", 0, -5, Number.NaN, null]) {
      assert.equal(parsePriceCents(bad), null, `deveria rejeitar ${JSON.stringify(bad)}`);
    }
    assert.equal(formatPriceForSheet(799905), "7999,05");
    assert.equal(parsePriceCents(formatPriceForSheet(123)), 123);
  });

  test("products import: booleans and variants follow the documented format", () => {
    assert.deepEqual(parseBooleanCell("Não"), { kind: "value", value: false });
    assert.deepEqual(parseBooleanCell(" SIM "), { kind: "value", value: true });
    assert.deepEqual(parseBooleanCell(1), { kind: "value", value: true });
    assert.deepEqual(parseBooleanCell(""), { kind: "empty" });
    assert.deepEqual(parseBooleanCell("talvez"), { kind: "invalid" });

    const ok = parseVariants("iPhone 17 / Azul / 256 GB / 7999,00 | iPhone 17 /  / 512 GB / 9.499,00");
    assert.deepEqual(ok.errors, []);
    assert.deepEqual(ok.variants, [
      { model: "iPhone 17", color: "Azul", storage: "256 GB", price_cents: 799900 },
      { model: "iPhone 17", color: null, storage: "512 GB", price_cents: 949900 },
    ]);
    const bad = parseVariants("Azul / 256 GB / 10 | a / b / c / zero | x / y / z / 1 | X / Y / Z / 2 | / / / 3");
    assert.equal(bad.variants.length, 1);
    assert.equal(bad.errors.length, 4);
    assert.match(bad.errors[0], /Variante 1/);
    assert.match(bad.errors[1], /preço inválido/);
    assert.match(bad.errors[2], /duplicada/);
    assert.match(bad.errors[3], /ao menos/);
  });

  test("products import: missing required columns are reported before any row", () => {
    const parsed = parseProductTable([
      ["Nome", "Preço", "extra"],
      ["iPhone", "10"],
    ]);
    assert.deepEqual(parsed.missingColumns, ["categoria", "modelo", "armazenamento"]);
    assert.match(parsed.error, /categoria, modelo, armazenamento/);
    assert.deepEqual(parsed.rows, []);

    assert.match(parseProductTable([]).error, /vazio/);
    assert.match(parseProductTable([["nome", "categoria", "modelo", "armazenamento", "preco"]]).error, /Nenhuma linha/);
    assert.match(parseProductTable([["nome", "Nome", "categoria"]]).error, /mais de uma vez/);
    for (const col of PRODUCT_COLUMNS.filter((c) => c.required)) {
      assert.ok(["nome", "categoria", "modelo", "armazenamento", "preco"].includes(col.key));
    }
  });

  test("products import: rows are validated individually with spreadsheet line numbers", () => {
    const parsed = parseProductTable([
      ["nome", "categoria", "modelo", "armazenamento", "preco", "ativo", "imagem_capa", "Coluna X"],
      ["iPhone 17", "iPhone", "iPhone 17", "256 GB", "7999,00", "", "", "ignorado"],
      [],
      ["", "iPhone", "iPhone 17", "", "abc", "talvez", "ftp://x", ""],
      ["iPhone 17", "iPhone", "iPhone 17", "256 GB", "1", "sim", "", ""],
    ]);
    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.unknownHeaders, ["Coluna X"]);
    assert.equal(parsed.rows.length, 3);

    const [first, broken, dup] = parsed.rows;
    assert.equal(first.line, 2);
    assert.deepEqual(first.errors, []);
    assert.equal(first.values.slug, "iphone-17-256-gb");
    assert.equal(first.values.slugProvided, false);
    assert.equal(first.values.active, undefined);
    assert.equal(first.values.brand, undefined);
    assert.equal(first.values.color, undefined, "coluna ausente não sobrescreve");
    assert.equal(first.values.image_url, null, "coluna presente e vazia limpa o valor");

    assert.equal(broken.line, 4);
    assert.equal(broken.values, null);
    assert.equal(broken.errors.length, 5);
    assert.ok(broken.errors.some((e) => e.startsWith("nome")));
    assert.ok(broken.errors.some((e) => e.startsWith("armazenamento")));
    assert.ok(broken.errors.some((e) => e.startsWith("preco inválido")));
    assert.ok(broken.errors.some((e) => e.startsWith("ativo inválido")));
    assert.ok(broken.errors.some((e) => e.startsWith("imagem_capa")));

    assert.equal(dup.line, 5);
    assert.equal(dup.values, null);
    assert.match(dup.errors[0], /repetido \(linha 2\)/);
  });

  test("products import: plan upserts by id or slug and rejects unknown ids", () => {
    const parsed = parseProductTable([
      ["id", "nome", "slug", "categoria", "modelo", "armazenamento", "preco"],
      ["", "Novo", "", "Mac", "Mac mini", "512 GB", "5000"],
      ["", "Existente", "iphone-17-256", "iPhone", "iPhone 17", "256 GB", "5000"],
      ["p-2", "Renomeado", "", "iPhone", "iPhone 16", "128 GB", "4000"],
      ["p-9", "Fantasma", "", "iPhone", "iPhone 16", "128 GB", "4000"],
      ["p-2", "Conflito", "iphone-17-256", "iPhone", "iPhone 16", "128 GB", "4000"],
      ["", "Ruim", "", "iPhone", "iPhone 16", "128 GB", "0"],
    ]);
    const plan = planImport(parsed.rows, [
      { id: "p-1", slug: "iphone-17-256" },
      { id: "p-2", slug: "iphone-16-128" },
    ]);
    assert.deepEqual(
      plan.map((row) => [row.line, row.action, row.productId]),
      [
        [2, "create", null],
        [3, "update", "p-1"],
        [4, "update", "p-2"],
        [5, "error", null],
        [6, "error", null],
        [7, "error", null],
      ],
    );
    assert.equal(plan[2].values.slug, "iphone-16-128", "atualização por id mantém o slug atual");
    assert.match(plan[3].errors[0], /não encontrado/);
    assert.match(plan[5].errors[0], /preco/);
    assert.deepEqual(summarizePlan(plan), { create: 1, update: 2, error: 3 });
  });

  test("products import: exported CSV re-imports to the same product data", () => {
    const table = productsToTable([product]);
    assert.deepEqual(table[0], [...PRODUCT_HEADERS]);
    const csv = toCsv(table);
    const parsed = parseProductTable(parseCsv(csv));
    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.unknownHeaders, []);
    assert.equal(parsed.rows.length, 1);
    assert.deepEqual(parsed.rows[0].errors, []);
    const values = parsed.rows[0].values;
    assert.deepEqual(values, {
      id: product.id,
      name: product.name,
      slug: product.slug,
      slugProvided: true,
      category: "iPhone",
      brand: "Apple",
      model: product.model,
      storage: product.storage,
      color: "Azul",
      list_price_cents: 999990,
      image_url: product.image_url,
      product_images: product.product_images,
      description: product.description,
      active: false,
      variants: [
        { model: "iPhone 17 Pro", color: "Azul", storage: "256 GB", price_cents: 999990 },
        { model: "iPhone 17 Pro", color: null, storage: "512 GB", price_cents: 1149900 },
      ],
    });
    const plan = planImport(parsed.rows, [{ id: product.id, slug: product.slug }]);
    assert.equal(plan[0].action, "update");
    assert.equal(plan[0].productId, product.id);
  });

  test("products import: CSV export neutralizes spreadsheet formulas and restores them on import", () => {
    const table = productsToTable([{ ...product, name: "=HYPERLINK(\"x\")", description: "-bom" }]);
    const csv = toCsv(table);
    assert.equal(csv.includes(";=HYPERLINK"), false);
    assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
    const values = parseProductTable(parseCsv(csv)).rows[0].values;
    assert.equal(values.name, '=HYPERLINK("x")');
    assert.equal(values.description, "-bom");
  });

  test("products import: template file is valid and matches the schema", () => {
    const template = templateTable();
    assert.deepEqual(template[0], [...PRODUCT_HEADERS]);
    const parsed = parseProductTable(template);
    assert.equal(parsed.error, null);
    assert.equal(parsed.rows.length, 2);
    assert.ok(parsed.rows.every((row) => row.errors.length === 0));
    assert.equal(parsed.rows[0].values.variants.length, 2);
    assert.equal(parsed.rows[1].values.active, false);
    assert.equal(transferFormatFromName("Produtos.XLSX"), "xlsx");
    assert.equal(transferFormatFromName("p.csv"), "csv");
    assert.equal(transferFormatFromName("p.xls"), null);
  });
}
