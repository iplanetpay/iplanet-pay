import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { parseBearerAuthorization } from "@/lib/auth/bearer";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";

/** JWT from `Authorization: Bearer`, or null when the request uses the site cookie. */
export async function requestAccessToken(): Promise<string | null> {
  const headerStore = await headers();
  return parseBearerAuthorization(headerStore.get("authorization"));
}

export async function createClient() {
  if (USE_MOCK_AUTH) {
    throw new Error("Supabase server client indisponível em modo mock.");
  }

  const cookieStore = await cookies();
  const accessToken = await requestAccessToken();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : undefined,
      cookies: {
        getAll() {
          // A bearer request must not inherit a browser cookie session.
          if (accessToken) return [];
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          if (accessToken) return;
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de Server Component — middleware atualiza sessão.
          }
        },
      },
    },
  );
}
