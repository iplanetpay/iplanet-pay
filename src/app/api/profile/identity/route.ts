import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeBrazilPhone } from "@/lib/phone";
import { normalizeCpf, profileIdentityComplete } from "@/lib/profile/identity";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Entre para continuar." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    cpf?: string;
    city?: string;
    address?: string;
    birth_date?: string;
  };

  const phone = normalizeBrazilPhone(body.phone);
  const cpf = normalizeCpf(body.cpf);
  const city = (body.city ?? "").trim();
  const address = (body.address ?? "").trim();
  const birthDate = (body.birth_date ?? "").trim();

  if (!profileIdentityComplete({ cpf, phone, city, address, birthDate })) {
    return NextResponse.json(
      { ok: false, error: "Informe CPF, telefone, cidade, endereço e data de nascimento." },
      { status: 400 },
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      phone,
      cpf,
      city,
      address,
      birth_date: birthDate,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
