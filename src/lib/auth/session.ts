import { cache } from "react";
import { cookies } from "next/headers";
import {
  MOCK_COOKIE,
  MOCK_USERS,
  USE_MOCK_AUTH,
  parseMockSession,
} from "@/lib/auth/mock";
import { avatarFromAuthMetadata, resolveProfileAvatar } from "@/lib/auth/avatar";
import { signedInWithGoogle } from "@/lib/profile/identity";
import type { AuthUser, PixKeyType } from "@/types/auth";

const PIX_TYPES: PixKeyType[] = ["cpf", "cnpj", "email", "phone", "random"];

function asPixKeyType(value: unknown): PixKeyType | null {
  if (typeof value !== "string") return null;
  return PIX_TYPES.includes(value as PixKeyType)
    ? (value as PixKeyType)
    : null;
}

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  if (USE_MOCK_AUTH) {
    const cookieStore = await cookies();
    return parseMockSession(cookieStore.get(MOCK_COOKIE)?.value);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, phone, role, store_id, avatar_url, pix_key, pix_key_type, referral_bonus_balance_cents",
    )
    .eq("id", user.id)
    .maybeSingle();

  const fromProvider = avatarFromAuthMetadata(user);
  const avatar_url = resolveProfileAvatar(profile?.avatar_url, fromProvider);

  if (!profile?.avatar_url?.trim() && fromProvider) {
    await supabase
      .from("profiles")
      .update({ avatar_url: fromProvider })
      .eq("id", user.id);
  }

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? "Usuário",
    phone: profile?.phone ?? null,
    role: profile?.role ?? "cliente",
    store_id: profile?.store_id ?? null,
    avatar_url,
    pix_key: profile?.pix_key ?? null,
    pix_key_type: asPixKeyType(profile?.pix_key_type),
    referral_bonus_balance_cents:
      (profile as { referral_bonus_balance_cents?: number } | null)
        ?.referral_bonus_balance_cents ?? 0,
    signed_in_with_google: signedInWithGoogle(user),
  };
});

export { USE_MOCK_AUTH, MOCK_USERS };
