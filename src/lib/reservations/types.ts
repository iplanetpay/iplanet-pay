export type ReservationStatus =
  | "ativa"
  | "quitada"
  | "cancelada"
  | "retirada"
  | "trocada"
  | "saque_pendente"
  | "sacada";

export interface Reservation {
  id: string;
  user_id: string;
  product_id: string;
  store_id: string;
  status: ReservationStatus;
  list_price_cents: number;
  amount_paid_cents: number;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservationProduct {
  id: string;
  name: string;
  slug: string;
  brand: string;
  model: string;
  storage: string;
  color: string | null;
  image_url: string | null;
}

export interface ReservationStore {
  id: string;
  name: string;
  slug: string;
  city: string;
}

export interface ReservationClient {
  id: string;
  full_name: string;
  phone: string | null;
  /** profiles has no email column; kept optional for search UX / future. */
  email?: string | null;
}

export interface ReservationWithDetails extends Reservation {
  product: ReservationProduct | null;
  store: ReservationStore | null;
}

/** Ops list row: reservation + optional client profile (staff/admin RLS). */
export interface ReservationOpsRow extends ReservationWithDetails {
  client: ReservationClient | null;
}

export const ALL_RESERVATION_STATUSES: ReservationStatus[] = [
  "ativa",
  "quitada",
  "cancelada",
  "retirada",
  "trocada",
  "saque_pendente",
  "sacada",
];

export function isReservationStatus(value: string): value is ReservationStatus {
  return (ALL_RESERVATION_STATUSES as string[]).includes(value);
}

export const RESERVATION_DETAIL_SELECT = `
  id,
  user_id,
  product_id,
  store_id,
  status,
  list_price_cents,
  amount_paid_cents,
  notes,
  expires_at,
  created_at,
  updated_at,
  product:products (
    id,
    name,
    slug,
    brand,
    model,
    storage,
    color,
    image_url
  ),
  store:stores (
    id,
    name,
    slug,
    city
  )
`;

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  ativa: "Ativa",
  quitada: "Quitada",
  cancelada: "Cancelada",
  retirada: "Retirada",
  trocada: "Trocada",
  saque_pendente: "Saque pendente",
  sacada: "Sacada",
};

export type StatusTone = "neutral" | "accent" | "success" | "danger" | "lavender";

export const STATUS_TONE: Record<ReservationStatus, StatusTone> = {
  ativa: "accent",
  quitada: "success",
  cancelada: "danger",
  retirada: "lavender",
  trocada: "neutral",
  saque_pendente: "lavender",
  sacada: "neutral",
};

export function reservationProgress(
  r: Pick<Reservation, "amount_paid_cents" | "list_price_cents">,
) {
  if (!r.list_price_cents || r.list_price_cents <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((r.amount_paid_cents / r.list_price_cents) * 100)),
  );
}

export function reservationRemainingCents(
  r: Pick<Reservation, "amount_paid_cents" | "list_price_cents">,
) {
  return Math.max(0, r.list_price_cents - r.amount_paid_cents);
}

export function shortReservationId(id: string) {
  return id.replace(/-/g, "").slice(0, 8);
}

export function productSubtitle(product: ReservationProduct | null) {
  const bits = [product?.storage, product?.color].filter(Boolean);
  return bits.join(" · ");
}
