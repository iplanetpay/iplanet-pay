import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FAVORITE_COLORS,
  HEX_RE,
  hexFromColorName,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  parseColorHexInput,
  swatchHex,
} from "../../src/lib/catalog/colors.ts";
import { buildVariantOptions } from "../../src/lib/catalog/variants.ts";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

export default function suite(test) {
  test("favorite phone colors are valid hex and the name map agrees with them", () => {
    assert.ok(FAVORITE_COLORS.length >= 17);
    for (const c of FAVORITE_COLORS) {
      assert.match(c.hex, HEX_RE, c.name);
      assert.equal(hexFromColorName(c.name), c.hex, c.name);
    }
    assert.equal(hexFromColorName("Titânio natural"), "#BAB4A9");
    assert.equal(hexFromColorName("Azul-sierra"), "#9BB5CE");
    assert.equal(hexFromColorName("Xadrez"), null);
  });

  test("color hex input is normalized and invalid values are rejected server-side", () => {
    assert.equal(normalizeHex("#abc"), "#AABBCC");
    assert.equal(normalizeHex("1d1d1f"), "#1D1D1F");
    assert.equal(normalizeHex("#12345"), null);
    assert.equal(normalizeHex("red"), null);
    assert.deepEqual(parseColorHexInput(undefined), { ok: true, hex: null });
    assert.deepEqual(parseColorHexInput("#ba0c2e"), { ok: true, hex: "#BA0C2E" });
    assert.equal(parseColorHexInput("#ZZZZZZ").ok, false);
    assert.equal(parseColorHexInput(123).ok, false);
    for (const path of ["src/app/api/admin/products/route.ts", "src/app/api/admin/products/[id]/variants/route.ts"]) {
      assert.match(source(path), /parseColorHexInput\(body\.color_hex\)/, path);
    }
  });

  test("swatches use the stored hex, then the name, then neutral gray", () => {
    assert.equal(swatchHex("Preto", "#000000"), "#000000");
    assert.equal(swatchHex("Preto", null), "#1D1D1F");
    assert.equal(swatchHex("Xadrez", null), "#C7C7CC");
    const opts = buildVariantOptions(
      { color: "Lavanda", color_hex: "#c9b8e8", storage: "256 GB", list_price_cents: 1 },
      [{ id: "v", product_id: "p", color: "Preto", color_hex: "#000000", storage: "256 GB", price_cents: 2 }],
    );
    assert.deepEqual(opts.colorHexes, { Lavanda: "#C9B8E8", Preto: "#000000" });
  });

  test("hsv conversion round-trips for the picker", () => {
    for (const c of FAVORITE_COLORS) {
      const { h, s, v } = hexToHsv(c.hex);
      assert.equal(hsvToHex(h, s, v), c.hex, c.name);
    }
    assert.equal(hsvToHex(0, 1, 1), "#FF0000");
  });

  test("the migration adds color_hex with a format check and the same name map as the app", () => {
    const sql = source("supabase/migrations/035_reservation_variant.sql");
    assert.match(sql, /alter table public\.products add column if not exists color_hex text/);
    assert.match(sql, /alter table public\.product_variants add column if not exists color_hex text/);
    assert.match(sql, /check \(color_hex is null or color_hex ~ '\^#\[0-9A-F\]\{6\}\$'\)/);
    const latest = source("supabase/migrations/041_color_hex_bordo_laranja.sql");
    const sqlHexes = [...latest.matchAll(/then '(#[0-9A-F]{6})'/g)].map((m) => m[1]);
    const tsHexes = [...source("src/lib/catalog/colors.ts").matchAll(/^\s*\[\/.*\/i, "(#[0-9A-F]{6})"\]/gm)].map((m) => m[1]);
    assert.deepEqual(sqlHexes, tsHexes, "SQL backfill mirrors NAME_RULES in order");
    assert.match(source("docs/api-contract.md"), /color_hex/);
  });
}
