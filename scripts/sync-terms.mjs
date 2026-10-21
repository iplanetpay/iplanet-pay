// Gera src/lib/terms/terms-markdown.ts a partir de docs/termos-de-uso.md.
// Uso: node scripts/sync-terms.mjs
import { readFileSync, writeFileSync } from "node:fs";
const md = readFileSync(new URL("../docs/termos-de-uso.md", import.meta.url), "utf8");
const out = `// Gerado por scripts/sync-terms.mjs a partir de docs/termos-de-uso.md. Não edite à mão.\nexport const TERMS_MARKDOWN = ${JSON.stringify(md)};\n`;
writeFileSync(new URL("../src/lib/terms/terms-markdown.ts", import.meta.url), out);
