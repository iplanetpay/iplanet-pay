import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildVariantOptions,
  findVariant,
  imagesForColor,
  isComboAvailable,
  minPriceCents,
  selectColor,
  selectStorage,
  simulatorOptions,
  storageRank,
  variantLabel,
} from "../../src/lib/catalog/variants.ts";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const product = { id: "p1", name: "iPhone 17", color: "Lavanda", storage: "256 GB", list_price_cents: 799900 };
const rows = [
  { id: "v1", product_id: "p1", color: "Lavanda", storage: "512 GB", price_cents: 949900 },
  { id: "v2", product_id: "p1", color: "Preto", storage: "256 GB", price_cents: 799900 },
  { id: "v3", product_id: "p1", color: "Preto", storage: "1 TB", price_cents: 1199900 },
  { id: "dup", product_id: "p1", color: "lavanda", storage: "256 GB", price_cents: 1 },
  { id: "bad", product_id: "p1", color: "Azul", storage: "128 GB", price_cents: 0 },
];

export default function suite(test) {
  test("catalog variants list Cor and Armazenamento with the product itself as the base", () => {
    const opts = buildVariantOptions(product, rows);
    assert.deepEqual(opts.colors, ["Lavanda", "Preto"]);
    assert.deepEqual(opts.storages, ["256 GB", "512 GB", "1 TB"]);
    assert.equal(opts.variants.length, 4, "duplicate of the base and zero price are ignored");
    assert.equal(opts.variants[0].id, null);
    assert.equal(minPriceCents(opts), 799900);
    assert.ok(storageRank("1 TB") > storageRank("512 GB"));
  });

  test("unavailable combos are disabled and switching color keeps a valid storage", () => {
    const opts = buildVariantOptions(product, rows);
    assert.equal(isComboAvailable(opts, "Lavanda", "1 TB"), false);
    assert.equal(isComboAvailable(opts, "Preto", "1 TB"), true);
    const base = opts.variants[0];
    const big = selectStorage(opts, base, "512 GB");
    assert.equal(big.id, "v1");
    assert.equal(big.priceCents, 949900);
    assert.equal(selectStorage(opts, base, "1 TB"), base, "disabled combo does nothing");
    const black = selectColor(opts, big, "Preto");
    assert.equal(black.storage, "256 GB", "512 GB does not exist in Preto, falls back to the smallest");
    assert.equal(selectColor(opts, base, "Preto").id, "v2");
    assert.equal(findVariant(opts, "preto", "1 tb").id, "v3");
    assert.equal(variantLabel(black), "256 GB · Preto");
  });

  test("variant images put the chosen color first", () => {
    const imgs = ["https://x/iphone-17-lavanda.png", "https://x/iphone-17-preto.png", "https://x/caixa.png"];
    assert.deepEqual(imagesForColor(imgs, "Preto")[0], "https://x/iphone-17-preto.png");
    assert.deepEqual(imagesForColor(imgs, "Azul"), imgs);
    assert.deepEqual(imagesForColor(imgs, null), imgs);
  });

  test("the simulator lists one option per variant with its own price", () => {
    const opts = simulatorOptions([product], { p1: rows });
    assert.equal(opts.length, 4);
    assert.deepEqual(opts[0], { id: "p1", key: "p1:", variantId: null, name: "iPhone 17 · 256 GB · Lavanda", listPriceCents: 799900 });
    assert.equal(opts.find((o) => o.variantId === "v3").listPriceCents, 1199900);
    assert.equal(simulatorOptions([product], {})[0].name, "iPhone 17");
  });

  test("the chosen variant travels to the reservation and the goal", () => {
    assert.match(source("src/components/reservations/reserve-form.tsx"), /variant_id: variant\?\.id \?\? null/);
    assert.match(source("src/app/api/reservations/route.ts"), /variant_id/);
    assert.match(source("src/lib/reservations/mutations.ts"), /p_variant_id: variantId/);
    assert.match(source("src/lib/goals/contribution-goal.ts"), /createReservation\(productId, storeId, variantId\)/);
    const sql = source("supabase/migrations/035_reservation_variant.sql");
    assert.match(sql, /security definer/);
    assert.match(sql, /v\.active = true/);
    assert.match(sql, /v\.product_id = p_product_id/);
    assert.match(sql, /grant execute on function public\.create_reservation\(uuid, uuid, uuid\) to authenticated/);
  });
}
