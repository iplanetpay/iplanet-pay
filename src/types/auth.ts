export type UserRole = "cliente" | "parceiro" | "staff" | "admin";

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
  store_id?: string | null;
  avatar_url?: string | null;
  pix_key?: string | null;
  pix_key_type?: PixKeyType | null;
  referral_bonus_balance_cents?: number;
  signed_in_with_google?: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  store_id: string | null;
  referral_code?: string | null;
  referred_by?: string | null;
  avatar_url?: string | null;
  pix_key?: string | null;
  pix_key_type?: PixKeyType | null;
  created_at: string;
}
