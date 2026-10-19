import { MOCK_USERS } from "@/lib/auth/mock";
import type { WithdrawalWithDetails } from "@/lib/withdrawals/queries";

const CREATED_AT = "2026-10-12T14:30:00.000Z";

const MOCK_WITHDRAWALS: WithdrawalWithDetails[] = [
  {
    id: "mock-saque-ana",
    user_id: MOCK_USERS.cliente.id,
    reservation_id: "mock-reserva-saque",
    total_paid_cents: 150_000,
    fee_percentage: 30,
    fee_amount_cents: 45_000,
    refund_amount_cents: 105_000,
    pix_key: "cliente@iplanet.demo",
    pix_key_type: "email",
    holder_full_name: MOCK_USERS.cliente.full_name,
    holder_cpf: "390.533.447-05",
    status: "pending",
    payout_status: "pending_admin",
    admin_notes: null,
    processed_at: null,
    processed_by: null,
    password_confirmed_at: CREATED_AT,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    client_name: MOCK_USERS.cliente.full_name,
    product_name: "iPhone 16 Pro",
  },
];

export function mockListWithdrawals(userId?: string): WithdrawalWithDetails[] {
  return MOCK_WITHDRAWALS.filter((w) => !userId || w.user_id === userId);
}
