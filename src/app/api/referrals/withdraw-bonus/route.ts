import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";

/** Bônus de indicação: abre pedido de saque que só sai com aprovação do admin (Saques). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  if (USE_MOCK_AUTH) {
    return NextResponse.json({ ok: false, error: "Saque indisponível em modo demo." }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    pix_key?: string;
    pix_key_type?: string;
    holder_full_name?: string;
    holder_cpf?: string;
  };
  if (!body.pix_key || !body.pix_key_type || !body.holder_full_name || !body.holder_cpf) {
    return NextResponse.json(
      { ok: false, error: "Preencha a chave Pix, o tipo, o titular e o CPF." },
      { status: 400 },
    );
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_bonus_withdrawal", {
    p_pix_key: body.pix_key,
    p_pix_key_type: body.pix_key_type,
    p_holder_full_name: body.holder_full_name,
    p_holder_cpf: body.holder_cpf,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, request_id: data as string });
}
