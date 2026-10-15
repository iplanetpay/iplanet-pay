import { NextResponse } from "next/server";
import {
  MOCK_COOKIE,
  MOCK_USERS,
  USE_MOCK_AUTH,
  serializeMockSession,
} from "@/lib/auth/mock";
import { homeForRole } from "@/lib/auth/roles";
import { normalizeBrazilPhone } from "@/lib/phone";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    full_name?: string;
    email?: string;
    password?: string;
    phone?: string;
    referral_code?: string;
    terms_accepted?: boolean;
    terms_version?: string;
  };

  const phone = normalizeBrazilPhone(body.phone);

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

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: body.email ?? "",
    password: body.password ?? "",
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


  if (data.user) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      await admin
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: body.terms_version || "withdrawal-v1",
        })
        .eq("id", data.user.id);
    } catch {
      /* non-fatal if service role missing */
    }
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

  if (body.email) {
    try {
      const { notifyWelcome } = await import("@/lib/email/notify");
      void notifyWelcome({
        email: body.email,
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
  });
}
