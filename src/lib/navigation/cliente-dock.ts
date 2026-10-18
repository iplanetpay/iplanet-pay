export const CLIENTE_DOCK = [
  { href: "/app", label: "Início" },
  { href: "/app/catalogo", label: "Catálogo" },
  { href: "/app/carteira", label: "Carteira" },
  { href: "/app/metas", label: "Metas" },
  { href: "/app/indicacoes", label: "Indicações" },
  { href: "/app/configuracoes", label: "Conta" },
] as const;

export type ClienteDockHref = (typeof CLIENTE_DOCK)[number]["href"];
