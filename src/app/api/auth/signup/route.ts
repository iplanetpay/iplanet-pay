import { NextResponse } from "next/server";
import {
  MOCK_COOKIE,
  MOCK_USERS,
  USE_MOCK_AUTH,
  serializeMockSession,
} from "@/lib/auth/mock";
import { homeForRole } from "@/lib/auth/roles";
import { normalizeBrazilPhone } from "@/lib/phone";
import {
  identityMissingMessage,
  normalizeCpf,
  normalizeState,
} from "@/lib/profile/identity";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    full_name?: string;
    email?: string;
    password?: string;
    phone?: string;
    referral_code?: string;
    cpf?: string;
    city?: string;
    state?: string;
    address?: string;
    address_number?: string;
    birth_date?: string;
    terms_accepted?: boolean;
    terms_version?: string;
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

  if (!body.terms_accepted) {
    return NextResponse.json(
      { ok: false, error: "Aceite os Termos de Uso para criar a conta." },
      { status: 400 },
    );
  }

  if (USE_MOCK_AUTH) {
    const user = {
      ...MOCK_USERS.cliente,
      email: body.email || MOCK_USERS.cliente.email,
      full_name: body.full_name || MOCK_USERS.cliente.full_name,
      phone: phone || MOCK_USERS.cliente.phone,
    };
    const response = NextResponse.json({
      ok: true,
      user,
      redirectTo: homeForRole("cliente"),
      mode: "mock",
    });
    response.cookies.set(MOCK_COOKIE, serializeMockSession(user), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  if (!email || password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Informe e-mail e senha com pelo menos 6 caracteres." },
      { status: 400 },
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: body.full_name,
        phone,
      },
    },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Falha ao criar conta" },
      { status: 400 },
    );
  }

  try {
    const { tryCreateServiceClient } = await import("@/lib/supabase/admin");
    const admin = tryCreateServiceClient();
    if (admin) {
      await admin
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: body.terms_version || "withdrawal-v1",
          phone,
          full_name: body.full_name ?? null,
        })
        .eq("id", data.user.id);
      await admin
        .from("profiles")
        .update({
          cpf,
          city,
          state,
          address,
          address_number: addressNumber,
          birth_date: birthDate,
        })
        .eq("id", data.user.id);
    } else {
      await supabase
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: body.terms_version || "withdrawal-v1",
          phone,
        })
        .eq("id", data.user.id);
      await supabase
        .from("profiles")
        .update({
          cpf,
          city,
          state,
          address,
          address_number: addressNumber,
          birth_date: birthDate,
        })
        .eq("id", data.user.id);
    }
  } catch {
    /* non-fatal if identity columns are still missing */
  }

  const ref = (body.referral_code ?? "").trim();
  if (ref) {
    try {
      const { tryCreateServiceClient } = await import("@/lib/supabase/admin");
      const admin = tryCreateServiceClient();
      if (admin) {
        const code = ref.toUpperCase();
        const { data: referrer } = await admin
          .from("profiles")
          .select("id")
          .eq("referral_code", code)
          .maybeSingle();
        if (referrer?.id && referrer.id !== data.user.id) {
          await admin
            .from("profiles")
            .update({ referred_by: referrer.id })
            .eq("id", data.user.id)
            .is("referred_by", null);
          await admin.from("referrals").insert({
            referrer_id: referrer.id,
            referred_id: data.user.id,
            status: "pending",
            bonus_amount_cents: 5000,
          });
        }
      } else if (data.session) {
        await supabase.rpc("apply_referral_code", { p_code: ref });
      }
    } catch {
      // non-fatal: user can apply later in /app/indicacoes
    }
  }

  if (email) {
    try {
      const { notifyWelcome } = await import("@/lib/email/notify");
      void notifyWelcome({
        email,
        fullName: body.full_name,
      });
    } catch {
      /* non-fatal */
    }
  }

  return NextResponse.json({
    ok: true,
    redirectTo: homeForRole("cliente"),
    mode: "supabase",
    needs_email_confirmation: !data.session,
  });
}
