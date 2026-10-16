import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeBrazilPhone } from "@/lib/phone";
import {
  identityMissingMessage,
  normalizeCpf,
  normalizeState,
} from "@/lib/profile/identity";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Entre para continuar." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    cpf?: string;
    city?: string;
    state?: string;
    address?: string;
    address_number?: string;
    birth_date?: string;
  };

  const phone = normalizeBrazilPhone(body.phone);
  const cpf = normalizeCpf(body.cpf);
  const city = (body.city ?? "").trim();
  const state = normalizeState(body.state);
  const address = (body.address ?? "").trim();
  const addressNumber = (body.address_number ?? "").trim();
  const birthDate = (body.birth_date ?? "").trim();
  const missing = identityMissingMessage({
    cpf,
    phone,
    city,
    state,
    address,
    addressNumber,
    birthDate,
  });
  if (missing) {
    return NextResponse.json({ ok: false, error: missing }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      phone,
      cpf,
      city,
      state,
      address,
      address_number: addressNumber,
      birth_date: birthDate,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
