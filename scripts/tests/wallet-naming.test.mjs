import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
// Termos de Uso (texto jurídico) ficam fora: decisão do usuário.
const SKIP = [/src[\\/]lib[\\/]terms[\\/]/];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|swift)$/.test(name)) out.push(p);
  }
  return out;
}

/** Textos entre aspas/crases ou JSX que mostram "Carteira"/"carteira" como palavra. */
function userFacingHits(src) {
  const hits = [];
  src.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("///")) return;
    const cleaned = line
      .replace(/\/app\/carteira/g, "")
      .replace(/carteira:/g, "")
      .replace(/["'`]carteira["'`]/g, "")
      .replace(/\bcarteira\s*:/g, "");
    if (/\b[Cc]arteira\b/.test(cleaned) && !/Carteira(Page|View)/.test(cleaned)) hits.push(`${i + 1}: ${t}`);
  });
  return hits;
}

export default function suite(test) {
  test("wallet naming: nenhum texto visível diz Carteira (web + iOS)", () => {
    const files = [
      ...walk(join(root, "src")),
      ...walk(join(root, "ios")),
      join(root, "docs/support-ai.md"),
    ].filter((f) => !SKIP.some((r) => r.test(f)) && !/TermsOfUse\.swift$/.test(f));
    const bad = [];
    for (const f of files) {
      for (const h of userFacingHits(readFileSync(f, "utf8"))) bad.push(`${f.slice(root.length)}:${h}`);
    }
    assert.deepEqual(bad, []);
  });

  test("wallet naming: rótulos principais usam Wallet", () => {
    assert.match(readFileSync(join(root, "src/lib/navigation/cliente-dock.ts"), "utf8"), /label: "Wallet"/);
    assert.match(readFileSync(join(root, "ios/iPlanetPay/Features/Root/RootView.swift"), "utf8"), /Label\("Wallet"/);
    assert.match(readFileSync(join(root, "src/app/app/carteira/page.tsx"), "utf8"), /title: "Wallet"/);
  });
}
