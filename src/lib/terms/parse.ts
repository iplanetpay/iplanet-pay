import { TERMS_MARKDOWN } from "./terms-markdown.ts";

export const CONTRATO_DE_APORTE_ANCHOR = "contrato-de-aporte";

export type TermsBlock =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string; id: string }
  | { kind: "quote"; text: string }
  | { kind: "paragraph"; text: string };

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function headingId(text: string): string {
  if (/^\d+\.\s*contrato de aporte/i.test(text)) return CONTRATO_DE_APORTE_ANCHOR;
  const num = /^(\d+)\./.exec(text)?.[1];
  return num ? `clausula-${num}` : slug(text);
}

/** Converte o markdown dos Termos em blocos simples (sem HTML cru). */
export function parseTerms(md: string = TERMS_MARKDOWN): TermsBlock[] {
  const blocks: TermsBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "paragraph", text: para.join("\n") });
    para = [];
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim() === "---") {
      flush();
    } else if (line.startsWith("# ")) {
      flush();
      blocks.push({ kind: "title", text: line.slice(2).trim() });
    } else if (line.startsWith("## ")) {
      flush();
      const text = line.slice(3).trim();
      blocks.push({ kind: "heading", text, id: headingId(text) });
    } else if (line.startsWith("> ")) {
      flush();
      blocks.push({ kind: "quote", text: line.slice(2).trim() });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** Texto corrido (sem marcação) para a caixa de rolagem do cadastro. */
export function termsPlainText(md: string = TERMS_MARKDOWN): string {
  return md
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^---$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Divide "texto **negrito** texto" em partes. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((p) =>
      p.startsWith("**") && p.endsWith("**")
        ? { text: p.slice(2, -2), bold: true }
        : { text: p, bold: false },
    );
}
