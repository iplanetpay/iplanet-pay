/** Same values as the pickup_requests.status check constraint. */
export type FulfillmentStatus =
  | "pending"
  | "approved"
  | "in_transit"
  | "ready_pickup"
  | "completed"
  | "cancelled";

export type FulfillmentMode = "store" | "shipping";

export type FulfillmentFilter = "open" | "completed" | "cancelled" | "all";

export const FULFILLMENT_STATUSES: readonly FulfillmentStatus[] = [
  "pending",
  "approved",
  "in_transit",
  "ready_pickup",
  "completed",
  "cancelled",
];

export interface FulfillmentAddress {
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zip: string;
}

export interface FulfillmentAction {
  to: FulfillmentStatus;
  label: string;
}

export function isFulfillmentStatus(value: unknown): value is FulfillmentStatus {
  return typeof value === "string" && (FULFILLMENT_STATUSES as readonly string[]).includes(value);
}

export function isFulfillmentMode(value: unknown): value is FulfillmentMode {
  return value === "store" || value === "shipping";
}

export function fulfillmentModeLabel(mode: FulfillmentMode): string {
  switch (mode) {
    case "store":
      return "Retirada na loja";
    case "shipping":
      return "Entrega";
    default: {
      const _exhaustive: never = mode;
      throw new Error(`Modo inválido: ${String(_exhaustive)}`);
    }
  }
}

/** The label depends on the mode: "completed" is a pickup at the store or a delivery. */
export function fulfillmentStatusLabel(status: FulfillmentStatus, mode: FulfillmentMode): string {
  switch (status) {
    case "pending":
      return mode === "shipping" ? "Aguardando pagamento do frete" : "Retirada solicitada";
    case "approved":
      return "Em preparação";
    case "in_transit":
      return "Enviado";
    case "ready_pickup":
      return "Pronto para retirada na loja";
    case "completed":
      return mode === "shipping" ? "Entregue" : "Retirado";
    case "cancelled":
      return "Cancelado";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Status inválido: ${String(_exhaustive)}`);
    }
  }
}

export function fulfillmentStatusTone(
  status: FulfillmentStatus,
): "neutral" | "accent" | "success" | "danger" | "lavender" {
  switch (status) {
    case "pending":
      return "lavender";
    case "approved":
    case "in_transit":
    case "ready_pickup":
      return "accent";
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Status inválido: ${String(_exhaustive)}`);
    }
  }
}

export function isOpenFulfillment(status: FulfillmentStatus): boolean {
  return status !== "completed" && status !== "cancelled";
}

/**
 * Store: solicitada → em preparação → pronto na loja → retirado.
 * Shipping: aguardando frete → em preparação → enviado → entregue.
 */
export function nextFulfillmentAction(
  status: FulfillmentStatus,
  mode: FulfillmentMode,
): FulfillmentAction | null {
  switch (status) {
    case "pending":
      return { to: "approved", label: "Iniciar preparo" };
    case "approved":
      return mode === "shipping"
        ? { to: "in_transit", label: "Marcar como enviado" }
        : { to: "ready_pickup", label: "Marcar pronto na loja" };
    case "in_transit":
      return { to: "completed", label: "Confirmar entrega" };
    case "ready_pickup":
      return { to: "completed", label: "Confirmar retirada" };
    case "completed":
    case "cancelled":
      return null;
    default: {
      const _exhaustive: never = status;
      throw new Error(`Status inválido: ${String(_exhaustive)}`);
    }
  }
}

export function canMoveFulfillment(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
  mode: FulfillmentMode,
): boolean {
  if (to === "cancelled") return isOpenFulfillment(from);
  return nextFulfillmentAction(from, mode)?.to === to;
}

export function matchesFulfillmentFilter(
  status: FulfillmentStatus,
  filter: FulfillmentFilter,
): boolean {
  switch (filter) {
    case "open":
      return isOpenFulfillment(status);
    case "completed":
      return status === "completed";
    case "cancelled":
      return status === "cancelled";
    case "all":
      return true;
    default: {
      const _exhaustive: never = filter;
      throw new Error(`Filtro inválido: ${String(_exhaustive)}`);
    }
  }
}

export interface FulfillmentListItem {
  mode: FulfillmentMode;
  status: FulfillmentStatus;
  storeId: string | null;
  search: readonly (string | null | undefined)[];
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Status tab, mode, store and free text (client, phone, device, reservation id). */
export function filterFulfillment<T extends FulfillmentListItem>(
  rows: readonly T[],
  input: { filter: FulfillmentFilter; mode: FulfillmentMode | "all"; storeId: string; query: string },
): T[] {
  const query = fold(input.query);
  const digits = input.query.replace(/\D/g, "");
  return rows.filter((row) => {
    if (!matchesFulfillmentFilter(row.status, input.filter)) return false;
    if (input.mode !== "all" && row.mode !== input.mode) return false;
    if (input.storeId && row.storeId !== input.storeId) return false;
    if (!query) return true;
    return row.search.some((value) => {
      if (!value) return false;
      if (fold(value).includes(query)) return true;
      return digits.length >= 4 && value.replace(/\D/g, "").includes(digits);
    });
  });
}

export function fulfillmentCounts(rows: readonly { mode: FulfillmentMode; status: FulfillmentStatus }[]) {
  const open = rows.filter((row) => isOpenFulfillment(row.status));
  return {
    open: open.length,
    store: open.filter((row) => row.mode === "store").length,
    shipping: open.filter((row) => row.mode === "shipping").length,
    completed: rows.filter((row) => row.status === "completed").length,
    cancelled: rows.filter((row) => row.status === "cancelled").length,
    all: rows.length,
  };
}

/** Every request starts waiting for the team: nothing is ready at the store before it is prepared. */
export function initialFulfillmentStatus(mode: FulfillmentMode): FulfillmentStatus {
  switch (mode) {
    case "store":
    case "shipping":
      return "pending";
    default: {
      const _exhaustive: never = mode;
      throw new Error(`Modo inválido: ${String(_exhaustive)}`);
    }
  }
}

/** A reservation keeps one open pickup or delivery at a time. */
export function hasOpenFulfillment(rows: readonly { status: string }[]): boolean {
  return rows.some((row) => isFulfillmentStatus(row.status) && isOpenFulfillment(row.status));
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseFulfillmentAddress(raw: unknown): FulfillmentAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const address: FulfillmentAddress = {
    street: text(source.street),
    number: text(source.number),
    complement: text(source.complement),
    district: text(source.district ?? source.neighborhood),
    city: text(source.city),
    state: text(source.state).toUpperCase(),
    zip: text(source.zip ?? source.cep),
  };
  return Object.values(address).some(Boolean) ? address : null;
}

/** "Rua X, 10 · apto 2 · Bairro · Cidade/UF · CEP 00000-000" with empty parts left out. */
export function formatFulfillmentAddress(address: FulfillmentAddress | null): string {
  if (!address) return "";
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const cityState = [address.city, address.state].filter(Boolean).join("/");
  const digits = address.zip.replace(/\D/g, "");
  const zip = digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : address.zip;
  return [street, address.complement, address.district, cityState, zip ? `CEP ${zip}` : ""]
    .filter(Boolean)
    .join(" · ");
}

const SHIPPING_METHOD_LABEL: Record<string, string> = {
  sedex: "SEDEX",
  pac: "PAC",
  motoboy: "Motoboy (capital)",
};

export function shippingMethodLabel(method: string | null | undefined): string {
  if (!method) return "";
  return SHIPPING_METHOD_LABEL[method] ?? method;
}
