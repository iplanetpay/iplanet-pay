import { NextResponse } from "next/server";
import { TERMS_VERSION } from "@/lib/withdrawals/types";
import {
  MOCK_COOKIE,
  MOCK_USERS,
  USE_MOCK_AUTH,
  serializeMockSession,
} from "@/lib/auth/mock";
import { homeForRole } from "@/lib/auth/roles";
import { normalizeBrazilPhone } from "@/lib/phone";
import { nativeAuthFields } from "@/lib/auth/native-client";
import { resolveSignupAccess } from "@/lib/auth/signup-access";
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
    client?: string;
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
  const { tryCreateServiceClient } = await import("@/lib/supabase/admin");
  const supabase = await createClient();
  const admin = tryCreateServiceClient();

  let userId: string | null = null;
  let hasSession = false;
  let autoConfirmed = false;
  let session: { access_token: string; refresh_token: string; expires_at?: number | null } | null =
    null;

  // Prefer admin create with email already confirmed so signup is not blocked
  // by Supabase "Confirm email" / confirmation-email rate limits.
  if (admin) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        phone,
      },
    });
    if (created.error || !created.data.user) {
      return NextResponse.json(
        { ok: false, error: created.error?.message ?? "Falha ao criar conta" },
        { status: 400 },
      );
    }
    userId = created.data.user.id;
    autoConfirmed = true;
    const signedIn = await supabase.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) {
      return NextResponse.json(
        {
          ok: false,
          error:
            signedIn.error?.message ??
            "Conta criada, mas não foi possível entrar automaticamente.",
        },
        { status: 400 },
      );
    }
    hasSession = true;
    session = signedIn.data.session;
  } else {
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
    userId = data.user.id;
    hasSession = Boolean(data.session);
    session = data.session;
  }

  try {
    if (admin) {
      await admin
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: body.terms_version || TERMS_VERSION,
          phone,
          full_name: body.full_name ?? null,
        })
        .eq("id", userId);
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
        .eq("id", userId);
    } else {
      await supabase
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: body.terms_version || TERMS_VERSION,
          phone,
        })
        .eq("id", userId);
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
        .eq("id", userId);
    }
  } catch {
    /* non-fatal if identity columns are still missing */
  }

  const ref = (body.referral_code ?? "").trim();
  if (ref && userId) {
    try {
      if (admin) {
        const code = ref.toUpperCase();
        const { data: referrer } = await admin
          .from("profiles")
          .select("id")
          .eq("referral_code", code)
          .maybeSingle();
        if (referrer?.id && referrer.id !== userId) {
          await admin
            .from("profiles")
            .update({ referred_by: referrer.id })
            .eq("id", userId)
            .is("referred_by", null);
          await admin.from("referrals").insert({
            referrer_id: referrer.id,
            referred_id: userId,
            status: "pending",
            bonus_amount_cents: 5000,
          });
        }
      } else if (hasSession) {
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

  const access = resolveSignupAccess({ hasSession, autoConfirmed });
  return NextResponse.json({
    ok: true,
    redirectTo: homeForRole("cliente"),
    mode: "supabase",
    needs_email_confirmation: access.needsEmailConfirmation,
    ...nativeAuthFields(body.client, session),
  });
}
