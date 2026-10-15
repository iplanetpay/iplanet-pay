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
      address: string | null;
      birthDate: string | null;
    }
> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("cpf, phone, city, address, birth_date")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { readable: false };
  return {
    readable: true,
    complete: profileIdentityComplete({
      cpf: data?.cpf,
      phone: data?.phone,
      city: data?.city,
      address: data?.address,
      birthDate: data?.birth_date,
    }),
    cpf: data?.cpf ?? null,
    phone: data?.phone ?? null,
    city: data?.city ?? null,
    address: data?.address ?? null,
    birthDate: data?.birth_date ?? null,
  };
}

export async function aporteBlockedForUser(user: AuthUser): Promise<string | null> {
  if (user.role !== "cliente" || !user.signed_in_with_google) return null;
  const identity = await loadProfileIdentity(user.id);
  if (!identity.readable || identity.complete) return null;
  return INCOMPLETE;
}
