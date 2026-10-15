import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import type { PixKeyType } from "@/types/auth";
import { normalizeBrazilPhone } from "@/lib/phone";

const PIX_TYPES: PixKeyType[] = ["cpf", "cnpj", "email", "phone", "random"];

function asPixKeyType(value: unknown): PixKeyType | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const v = value.toLowerCase().trim();
  return PIX_TYPES.includes(v as PixKeyType) ? (v as PixKeyType) : undefined;
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autenticado." },
      { status: 401 },
    );
  }

  let body: {
    full_name?: string;
    phone?: string | null;
    email?: string;
    avatar_url?: string | null;
    pix_key?: string | null;
    pix_key_type?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.full_name !== undefined) {
    const full_name = String(body.full_name).trim();
    if (!full_name) {
      return NextResponse.json(
        { ok: false, error: "Informe o nome." },
        { status: 400 },
      );
    }
    updates.full_name = full_name;
  }

  if (body.phone !== undefined) {
    updates.phone =
      body.phone === null ? null : normalizeBrazilPhone(String(body.phone));
  }

  if (body.avatar_url !== undefined) {
    updates.avatar_url =
      body.avatar_url === null
        ? null
        : String(body.avatar_url).trim() || null;
  }

  if (body.pix_key !== undefined) {
    updates.pix_key =
      body.pix_key === null ? null : String(body.pix_key).trim() || null;
  }

  if (body.pix_key_type !== undefined) {
    const typed = asPixKeyType(body.pix_key_type);
    if (body.pix_key_type !== null && body.pix_key_type !== "" && typed === undefined) {
      return NextResponse.json(
        { ok: false, error: "Tipo de chave Pix inválido." },
        { status: 400 },
      );
    }
    updates.pix_key_type = typed === undefined ? null : typed;
  }

  const email =
    body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
  if (email !== undefined) {
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Informe um e-mail válido." },
        { status: 400 },
      );
    }
  }

  if (Object.keys(updates).length === 0 && email === undefined) {
    return NextResponse.json(
      { ok: false, error: "Nada para atualizar." },
      { status: 400 },
    );
  }

  if (USE_MOCK_AUTH) {
    return NextResponse.json({
      ok: true,
      email_pending: Boolean(email && email !== user.email),
    });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    let email_pending = false;
    if (email && email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) {
        return NextResponse.json(
          { ok: false, error: emailError.message },
          { status: 400 },
        );
      }
      email_pending = true;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);
      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ ok: true, email_pending });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao atualizar perfil";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
