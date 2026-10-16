import { profileIdentityComplete } from "@/lib/profile/identity";
import type { AuthUser } from "@/types/auth";

const INCOMPLETE =
  "Complete seu cadastro antes de fazer um aporte.";

export async function loadProfileIdentity(userId: string): Promise<
  | { readable: false }
  | {
      readable: true;
      complete: boolean;
      cpf: string | null;
      phone: string | null;
      city: string | null;
      state: string | null;
      address: string | null;
      addressNumber: string | null;
      birthDate: string | null;
    }
> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const extended = await supabase
    .from("profiles")
    .select("cpf, phone, city, state, address, address_number, birth_date")
    .eq("id", userId)
    .maybeSingle();
  if (extended.error) {
    if (!/column|schema cache/i.test(extended.error.message)) {
      return { readable: false };
    }
    const fallback = await supabase
      .from("profiles")
      .select("cpf, phone, city, address, birth_date")
      .eq("id", userId)
      .maybeSingle();
    if (fallback.error) return { readable: false };
    return {
      readable: true,
      complete: false,
      cpf: fallback.data?.cpf ?? null,
      phone: fallback.data?.phone ?? null,
      city: fallback.data?.city ?? null,
      state: null,
      address: fallback.data?.address ?? null,
      addressNumber: null,
      birthDate: fallback.data?.birth_date ?? null,
    };
  }
  const data = extended.data;
  return {
    readable: true,
    complete: profileIdentityComplete({
      cpf: data?.cpf,
      phone: data?.phone,
      city: data?.city,
      state: data?.state,
      address: data?.address,
      addressNumber: data?.address_number,
      birthDate: data?.birth_date,
    }),
    cpf: data?.cpf ?? null,
    phone: data?.phone ?? null,
    city: data?.city ?? null,
    state: data?.state ?? null,
    address: data?.address ?? null,
    addressNumber: data?.address_number ?? null,
    birthDate: data?.birth_date ?? null,
  };
}

export async function aporteBlockedForUser(user: AuthUser): Promise<string | null> {
  if (user.role !== "cliente" || !user.signed_in_with_google) return null;
  const identity = await loadProfileIdentity(user.id);
  if (!identity.readable || identity.complete) return null;
  return INCOMPLETE;
}
