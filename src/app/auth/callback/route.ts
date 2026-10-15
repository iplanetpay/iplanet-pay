import { NextResponse } from "next/server";
import { avatarFromAuthMetadata } from "@/lib/auth/avatar";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, roleAllowedForPath } from "@/lib/auth/roles";
import type { UserRole } from "@/types/auth";

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = safeNext(searchParams.get("next"));

  if (USE_MOCK_AUTH) {
    return NextResponse.redirect(`${origin}/entrar`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let role: UserRole = "cliente";

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        const avatarUrl = avatarFromAuthMetadata(user);

        if (!profile) {
          // Safety net if trigger missed (should be rare). Never overwrite admins.
          const fullName =
            (typeof user.user_metadata?.full_name === "string" &&
              user.user_metadata.full_name) ||
            (typeof user.user_metadata?.name === "string" &&
              user.user_metadata.name) ||
            "";
          await supabase.from("profiles").insert({
            id: user.id,
            full_name: fullName,
            role: "cliente",
            avatar_url: avatarUrl,
          });
          role = "cliente";
        } else {
          role = (profile.role ?? "cliente") as UserRole;
          const stored =
            typeof profile.avatar_url === "string" ? profile.avatar_url.trim() : "";
          if (!stored && avatarUrl) {
            await supabase
              .from("profiles")
              .update({ avatar_url: avatarUrl })
              .eq("id", user.id);
          }
        }
      }

      const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
      const justCreated = createdAt > 0 && Date.now() - createdAt < 2 * 60 * 1000;
      let dest = homeForRole(role);
      if (nextParam && roleAllowedForPath(role, nextParam)) {
        dest = nextParam;
      } else if (nextParam?.startsWith("/admin") && role !== "admin") {
        dest = `/entrar?error=${encodeURIComponent("Esta conta Google não tem permissão de admin.")}&next=/admin`;
      }
      if (justCreated && !dest.includes("cadastro=")) {
        dest += dest.includes("?") ? "&cadastro=ok" : "?cadastro=ok";
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${dest}`);
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${dest}`);
      }
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/entrar?error=${encodeURIComponent("Falha ao autenticar com Google.")}`,
  );
}
