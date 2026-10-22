/**
 * Cores de aparelhos: favoritas do admin, nome → hex e validação.
 * O hex gravado (products.color_hex / product_variants.color_hex) é sempre "#RRGGBB" maiúsculo.
 * Mantenha FAVORITE_COLORS alinhado com o backfill da migração 035.
 */

export const HEX_RE = /^#[0-9A-F]{6}$/;

export const FAVORITE_COLORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Preto", hex: "#1D1D1F" },
  { name: "Meia-noite", hex: "#232A31" },
  { name: "Branco", hex: "#F5F5F0" },
  { name: "Estelar", hex: "#F0E8DC" },
  { name: "Prata", hex: "#E3E4E5" },
  { name: "Cinza-espacial", hex: "#535150" },
  { name: "Grafite", hex: "#41424C" },
  { name: "Titânio natural", hex: "#BAB4A9" },
  { name: "Titânio preto", hex: "#3C3C3D" },
  { name: "Titânio branco", hex: "#F2F1ED" },
  { name: "Titânio deserto", hex: "#BFA48F" },
  { name: "Azul", hex: "#3D7EA6" },
  { name: "Azul-sierra", hex: "#9BB5CE" },
  { name: "Verde", hex: "#ADC7B4" },
  { name: "Rosa", hex: "#F2C9CE" },
  { name: "Roxo", hex: "#B7A6D8" },
  { name: "Lavanda", hex: "#C9B8E8" },
  { name: "Amarelo", hex: "#F5E39A" },
  { name: "Vermelho (PRODUCT)RED", hex: "#BA0C2E" },
  { name: "Dourado", hex: "#F4E3C1" },
  { name: "Laranja cósmico", hex: "#F77E2D" },
  { name: "Bordô", hex: "#6B2A35" },
];

/** Regras por nome, da mais específica para a mais genérica. */
const NAME_RULES: Array<[RegExp, string]> = [
  [/tit[aâ]nio\s*natural|natural/i, "#BAB4A9"],
  [/tit[aâ]nio\s*preto|black\s*titanium/i, "#3C3C3D"],
  [/tit[aâ]nio\s*branco|white\s*titanium/i, "#F2F1ED"],
  [/tit[aâ]nio\s*deserto|deserto|desert/i, "#BFA48F"],
  [/azul[\s-]*sierra|sierra/i, "#9BB5CE"],
  [/meia[\s-]*noite|midnight/i, "#232A31"],
  [/cinza[\s-]*espacial|space\s*gr[ae]y/i, "#535150"],
  [/grafite|graphite/i, "#41424C"],
  [/estelar|starlight/i, "#F0E8DC"],
  [/lavanda|lavender/i, "#C9B8E8"],
  [/bord[oô]|burgundy/i, "#6B2A35"],
  [/product|vermelho|red/i, "#BA0C2E"],
  [/preto|black|space/i, "#1D1D1F"],
  [/branco|white/i, "#F5F5F0"],
  [/prata|prateado|silver/i, "#E3E4E5"],
  [/azul|blue|ultramar/i, "#3D7EA6"],
  [/verde|green|teal/i, "#ADC7B4"],
  [/rosa|pink/i, "#F2C9CE"],
  [/roxo|purple/i, "#B7A6D8"],
  [/amarelo|yellow/i, "#F5E39A"],
  [/dourado|gold/i, "#F4E3C1"],
  [/laranja|orange|c[oó]smico/i, "#F77E2D"],
  [/tit[aâ]nio|titanium/i, "#8D8D92"],
];

export const FALLBACK_HEX = "#C7C7CC";

/** Hex aproximado pelo nome da cor (null se não reconhecer). */
export function hexFromColorName(name: string | null | undefined): string | null {
  const n = String(name ?? "").trim();
  if (!n) return null;
  for (const [re, hex] of NAME_RULES) if (re.test(n)) return hex;
  return null;
}

/** Aceita "#abc", "abc", "#aabbcc", "AABBCC" → "#AABBCC"; inválido → null. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(v)) v = v.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(v)) return null;
  return `#${v.toUpperCase()}`;
}

/**
 * Valida o campo color_hex vindo do admin: ausente/vazio → null (o backfill/nome decide);
 * valor presente e inválido → erro.
 */
export function parseColorHexInput(value: unknown): { ok: true; hex: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, hex: null };
  const hex = normalizeHex(value);
  return hex ? { ok: true, hex } : { ok: false, error: "Cor inválida: use o formato #RRGGBB." };
}

/** Cor exibida: hex gravado > hex pelo nome > cinza neutro. */
export function swatchHex(name: string | null | undefined, hex?: string | null): string {
  return normalizeHex(hex) ?? hexFromColorName(name) ?? FALLBACK_HEX;
}

// --- HSV para o seletor do admin ---
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const n = normalizeHex(hex) ?? FALLBACK_HEX;
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (u: number) => Math.round((u + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** Texto legível sobre a cor (para o ✓ no swatch). */
export function isLightHex(hex: string): boolean {
  const n = normalizeHex(hex) ?? FALLBACK_HEX;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}
