import type { UserRole } from "./auth";

export interface Store {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  created_at?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  model: string;
  storage: string;
  color: string | null;
  /** "#RRGGBB" da cor do produto (migração 035). */
  color_hex?: string | null;
  list_price_cents: number;
  image_url: string | null;
  description?: string | null;
  product_images?: string[] | null;
  active: boolean;
  category?: string;
  category_id?: string | null;
  created_at?: string;
}

export type PaymentGoalStatus = "active" | "paused" | "done" | "cancelled";

export interface PaymentGoal {
  id: string;
  user_id: string;
  product_id: string;
  reservation_id: string | null;
  name: string;
  target_date: string;
  /** Dia do mês 1–30; meses sem o dia usam o último dia */
  reminder_day: number | null;
  reminder_at: string | null;
  amount_cents: number;
  installment_cents: number;
  installments_count: number;
  /** daily, weekly ou monthly; metas antigas ficam sem cadência */
  frequency: "daily" | "weekly" | "monthly" | null;
  /** Dia de início do plano; aportes são posteriores a esta data */
  plan_start_date: string | null;
  status: PaymentGoalStatus;
  whatsapp_phone: string | null;
  created_at: string;
}

export type WhatsappTemplateKind =
  | "aviso"
  | "cobranca"
  | "promocao"
  | "bonus"
  | "custom";

export interface WhatsappTemplate {
  id: string;
  name: string;
  kind: WhatsappTemplateKind;
  body: string;
  active: boolean;
  created_at?: string;
}

export type WhatsappDispatchStatus =
  | "pending"
  | "sent"
  | "failed"
  | "skipped";

export interface WhatsappDispatchQueueItem {
  id: string;
  goal_id: string | null;
  template_id: string | null;
  to_phone: string;
  body: string;
  media_url: string | null;
  status: WhatsappDispatchStatus;
  scheduled_at: string;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

export interface StoreStock {
  id: string;
  store_id: string;
  product_id: string;
  qty_available: number;
}

export interface ProductWithStock extends Product {
  store_stock: Array<{
    qty_available: number;
    store: Pick<Store, "id" | "name" | "slug"> | null;
  }>;
}

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

export type { UserRole };


export type ContributionStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "refunded"
  | "expired";

export interface Contribution {
  id: string;
  user_id: string;
  reservation_id: string;
  amount_cents: number;
  payment_method: string;
  status: ContributionStatus;
  pix_code: string | null;
  pix_qr_base64: string | null;
  gateway_payment_id: string | null;
  gateway_provider: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WalletEntryType = "aporte" | "aplicacao" | "estorno" | "ajuste";

export interface WalletLedgerEntry {
  id: string;
  user_id: string;
  reservation_id: string | null;
  contribution_id: string | null;
  entry_type: WalletEntryType;
  amount_cents: number;
  memo: string | null;
  created_at: string;
}

export type WithdrawalStatus = "pending" | "approved" | "rejected" | "cancelled";

export type WithdrawalPayoutStatus =
  | "pending_admin"
  | "pending_gateway"
  | "queued"
  | "sent"
  | "failed";

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  reservation_id: string;
  total_paid_cents: number;
  fee_percentage: number;
  fee_amount_cents: number;
  refund_amount_cents: number;
  pix_key: string;
  pix_key_type: PixKeyType;
  holder_full_name: string;
  holder_cpf: string;
  status: WithdrawalStatus;
  payout_status: WithdrawalPayoutStatus;
  admin_notes: string | null;
  processed_at: string | null;
  processed_by: string | null;
  password_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}
