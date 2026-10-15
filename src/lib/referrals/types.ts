export type ReferralStatus = "pending" | "completed" | "cap_reached" | "cancelled";

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: ReferralStatus;
  bonus_amount_cents: number;
  bonus_credited: boolean;
  credited_at: string | null;
  created_at: string;
}

export interface ReferralWithReferred extends Referral {
  referred?: { full_name: string | null } | null;
  confirmed_cents?: number;
}

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  pending: "Aguardando aporte",
  completed: "Bônus creditado",
  cap_reached: "Limite atingido",
  cancelled: "Cancelada",
};

export const REFERRAL_SELECT = `
  id,
  referrer_id,
  referred_id,
  status,
  bonus_amount_cents,
  bonus_credited,
  credited_at,
  created_at
`;
