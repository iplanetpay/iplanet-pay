/**
 * Descrição rica de produto (products.description_md, migração 039).
 *
 * Formato: subconjunto de Markdown, sem HTML. O mesmo parser é a referência
 * para o app iOS (docs/api-contract.md → "Descrição rica de produto").
 *
 * Blocos: "## " seção, "### " subtítulo, parágrafo, lista "- ", imagem
 * "![legenda](url)" sozinha na linha, tabela "| a | b |" (2ª linha "|---|---|").
 * Inline: **negrito**. Qualquer HTML vira texto (nunca é interpretado).
 */

export type RichInline = { text: string; bold: boolean };

export type RichBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; inlines: RichInline[] }
  | { type: "list"; items: RichInline[][] }
  | { type: "image"; url: string; alt: string }
  | { type: "table"; header: string[]; rows: string[][] };

export const RICH_DESCRIPTION_MAX_CHARS = 20000;

const STORAGE_PATH = "/storage/v1/object/public/product-images/";

/** Só aceita imagens do bucket público product-images (Supabase) ou /products/ local. */
export function isAllowedDescriptionImage(url: string): boolean {
  const u = url.trim();
  if (/^\/products\/[A-Za-z0-9._\-/]+$/.test(u) && !u.includes("..")) return true;
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    /^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) &&
    parsed.pathname.startsWith(STORAGE_PATH) &&
    !parsed.pathname.includes("..")
  );
}

export function parseInlines(text: string): RichInline[] {
  const out: RichInline[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out.filter((i) => i.text.length > 0);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim().replace(/\*\*(.+?)\*\*/g, "$1"));
}

const IMAGE_RE = /^!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)$/;
const TABLE_SEP_RE = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

export function parseRichDescription(source: string | null | undefined): RichBlock[] {
  if (!source) return [];
  const lines = source.slice(0, RICH_DESCRIPTION_MAX_CHARS).replace(/\r\n?/g, "\n").split("\n");
  const blocks: RichBlock[] = [];
  let para: string[] = [];
  let list: RichInline[][] | null = null;

  const flush = () => {
    if (para.length) {
      blocks.push({ type: "paragraph", inlines: parseInlines(para.join(" ")) });
      para = [];
    }
    if (list) {
      blocks.push({ type: "list", items: list });
      list = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{2,3})\s+(.+)$/.exec(line) ?? /^#\s+(.+)$/.exec(line);
    if (h) {
      flush();
      const level = h.length === 3 && h[1] === "###" ? 3 : 2;
      blocks.push({ type: "heading", level, text: (h[2] ?? h[1]).replace(/\*\*/g, "").trim() });
      continue;
    }
    const img = IMAGE_RE.exec(line);
    if (img) {
      flush();
      if (isAllowedDescriptionImage(img[2])) {
        blocks.push({ type: "image", url: img[2], alt: img[1].trim() });
      }
      continue;
    }
    if (line.startsWith("|") && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1].trim())) {
      flush();
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = splitRow(lines[i]);
        rows.push(header.map((_, c) => cells[c] ?? ""));
        i++;
      }
      i--;
      blocks.push({ type: "table", header, rows });
      continue;
    }
    const li = /^[-*•]\s+(.+)$/.exec(line);
    if (li) {
      if (para.length) {
        blocks.push({ type: "paragraph", inlines: parseInlines(para.join(" ")) });
        para = [];
      }
      list = list ?? [];
      list.push(parseInlines(li[1]));
      continue;
    }
    if (list) {
      blocks.push({ type: "list", items: list });
      list = null;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** Texto curto (sem marcação) para cards, SEO e fallback. */
export function richDescriptionPlainText(source: string | null | undefined, max = 220): string {
  const text = parseRichDescription(source)
    .filter((b) => b.type === "paragraph")
    .map((b) => (b.type === "paragraph" ? b.inlines.map((i) => i.text).join("") : ""))
    .join(" ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Monta o Markdown de uma imagem para o botão "Inserir foto". */
export function imageMarkdown(url: string, alt: string): string {
  const safeAlt = alt.replace(/[\[\]\n]/g, " ").trim() || "Foto";
  return `\n\n![${safeAlt}](${url})\n\n`;
}
