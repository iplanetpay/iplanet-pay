/** Tiny Markdown → block model for previews and chat bubbles. No HTML is ever injected. */
export type MdInline = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type MdBlock =
  | { kind: "heading"; level: 1 | 2 | 3; inline: MdInline[] }
  | { kind: "paragraph"; inline: MdInline[] }
  | { kind: "list"; ordered: boolean; items: MdInline[][] }
  | { kind: "rule" };

export function parseInline(text: string): MdInline[] {
  const out: MdInline[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ text: text.slice(last, idx) });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith("`")) out.push({ text: tok.slice(1, -1), code: true });
    else out.push({ text: tok.slice(1, -1), italic: true });
    last = idx + tok.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function parseMarkdown(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: MdInline[][] } | null = null;
  const flush = () => {
    if (para.length) blocks.push({ kind: "paragraph", inline: parseInline(para.join(" ")) });
    para = [];
    if (list) blocks.push({ kind: "list", ...list });
    list = null;
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ kind: "heading", level: h[1].length as 1 | 2 | 3, inline: parseInline(h[2]) });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }
    const li = /^(?:([-*])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      const ordered = Boolean(li[2]);
      if (para.length) {
        blocks.push({ kind: "paragraph", inline: parseInline(para.join(" ")) });
        para = [];
      }
      if (!list || list.ordered !== ordered) {
        if (list) blocks.push({ kind: "list", ...list });
        list = { ordered, items: [] };
      }
      list.items.push(parseInline(li[3]));
      continue;
    }
    if (list) {
      blocks.push({ kind: "list", ...list });
      list = null;
    }
    para.push(line);
  }
  flush();
  return blocks;
}
