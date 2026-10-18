/** Main cliente app routes — prefetched after shell mount. */
export const CLIENTE_PREFETCH_ROUTES = [
  "/app",
  "/app/catalogo",
  "/app/reservas",
  "/app/carteira",
  "/app/metas",
  "/app/simulador",
  "/app/indicacoes",
  "/app/configuracoes",
  "/app/ranking",
  "/app/perfil",
] as const;

/** Admin panel routes — prefetched after shell mount. */
export const ADMIN_PREFETCH_ROUTES = [
  "/admin",
  "/admin/dashboards",
  "/admin/reservas",
  "/admin/avaliacao-usados",
  "/admin/clientes",
  "/admin/produtos",
  "/admin/whatsapp",
  "/admin/financeiro",
  "/admin/sorteio",
  "/admin/avisos",
  "/admin/config",
  "/admin/indicacoes",
  "/admin/estoque",
  "/admin/emails/preview",
] as const;
