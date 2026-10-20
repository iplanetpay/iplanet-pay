import { NextResponse } from "next/server";
import { magicLinkRedirect } from "@/lib/auth/native-client";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; redirectTo?: string };

  if (USE_MOCK_AUTH) {
    return NextResponse.json({
      ok: true,
      message:
        "Modo demo: magic link ainda não disponível. Use o login por papel abaixo.",
      mode: "mock",
    });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const origin = new URL(request.url).origin;
  const { error } = await supabase.auth.signInWithOtp({
    email: body.email ?? "",
    options: {
      emailRedirectTo: magicLinkRedirect(origin, body.redirectTo),
    },
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Link mágico enviado. Verifique seu e-mail.",
    mode: "supabase",
  });
}
