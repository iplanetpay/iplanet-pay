import { termsPlainText } from "../terms/parse.ts";
import type {
  PixKeyType,
  WithdrawalSource,
  WithdrawalPayoutStatus,
  WithdrawalRequest,
  WithdrawalStatus,
} from "@/types/database";

export type {
  PixKeyType,
  WithdrawalSource,
  WithdrawalPayoutStatus,
  WithdrawalRequest,
  WithdrawalStatus,
};

export const WITHDRAWAL_FEE_PCT_DEFAULT = 30;

export const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
};

export const PAYOUT_STATUS_LABEL: Record<WithdrawalPayoutStatus, string> = {
  pending_admin: "Aguardando admin",
  pending_gateway: "Aguardando gateway",
  queued: "Na fila",
  sent: "Enviado",
  failed: "Falhou",
};

export const PIX_KEY_TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Aleatória",
};

export const WITHDRAWAL_SELECT = `
  id,
  user_id,
  reservation_id,
  total_paid_cents,
  fee_percentage,
  fee_amount_cents,
  refund_amount_cents,
  pix_key,
  pix_key_type,
  holder_full_name,
  holder_cpf,
  status,
  payout_status,
  admin_notes,
  processed_at,
  processed_by,
  password_confirmed_at,
  created_at,
  updated_at
`;

/** Colunas da migration 037 (origem e quebra integral/desconto). */
export const WITHDRAWAL_SELECT_V037 = `${WITHDRAWAL_SELECT},
  source,
  full_refund_cents,
  discounted_cents
`;

/** Erro de coluna inexistente (banco ainda sem a 037). */
export function isMissingColumnError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /column .* does not exist|could not find the .* column|42703|PGRST204/i.test(message);
}

export const WITHDRAWAL_SOURCE_LABEL: Record<WithdrawalSource, string> = {
  reserva: "Reserva",
  carteira: "Carteira",
  bonus: "Bônus de indicação",
};

/** Origem do saque, inclusive para linhas anteriores à 037. */
export function withdrawalSource(w: {
  source?: WithdrawalSource | null;
  admin_notes?: string | null;
}): WithdrawalSource {
  if (w.source) return w.source;
  if (w.admin_notes === "carteira") return "carteira";
  return "reserva";
}

export function calcWithdrawalAmounts(
  totalPaidCents: number,
  feePct = WITHDRAWAL_FEE_PCT_DEFAULT,
) {
  const fee = Math.round((totalPaidCents * feePct) / 100);
  const refund = totalPaidCents - fee;
  return { fee_amount_cents: fee, refund_amount_cents: refund, fee_percentage: feePct };
}

/** Versão dos Termos publicada em /termos (docs/termos-de-uso.md). */
export const TERMS_VERSION = "platform-v4";

export const TERMS_OF_USE_PT = termsPlainText();
