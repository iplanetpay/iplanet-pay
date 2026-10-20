import { NextResponse } from "next/server";
import {
  MOCK_COOKIE,
  MOCK_USERS,
  USE_MOCK_AUTH,
  serializeMockSession,
} from "@/lib/auth/mock";
import type { UserRole } from "@/types/auth";
import { nativeAuthFields } from "@/lib/auth/native-client";
import { homeForRole, roleAllowedForPath } from "@/lib/auth/roles";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    role?: UserRole;
    next?: string;
    client?: string;
  };

  if (USE_MOCK_AUTH) {
    const role = (body.role ?? "cliente") as UserRole;
    const user = MOCK_USERS[role] ?? MOCK_USERS.cliente;
    const response = NextResponse.json({
      ok: true,
      user,
      redirectTo: homeForRole(user.role),
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
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Contas antigas criadas com "Confirm email" no Supabase: confirma e tenta de novo.
  if (error && /email not confirmed/i.test(error.message)) {
    try {
      const { tryCreateServiceClient } = await import("@/lib/supabase/admin");
      const admin = tryCreateServiceClient();
      if (admin) {
        const linked = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        const userId = linked.data.user?.id;
        if (userId) {
          await admin.auth.admin.updateUserById(userId, { email_confirm: true });
          const retry = await supabase.auth.signInWithPassword({ email, password });
          data = retry.data;
          error = retry.error;
        }
      }
    } catch {
      /* keep original error */
    }
  }

  if (error || !data.user) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Falha ao entrar" },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = (profile?.role ?? "cliente") as UserRole;

  const requestedNext =
    typeof body.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//")
      ? body.next
      : null;

  let redirectTo = homeForRole(role);
  let warning: string | undefined;

  if (requestedNext && roleAllowedForPath(role, requestedNext)) {
    redirectTo = requestedNext;
  } else if (requestedNext?.startsWith("/admin") && role !== "admin") {
    warning =
      "Esta conta não tem permissão de admin. No Supabase, defina profiles.role = admin para seu usuário.";
  }

  return NextResponse.json({
    ok: true,
    redirectTo,
    warning,
    mode: "supabase",
    ...nativeAuthFields(body.client, data.session),
  });
}
