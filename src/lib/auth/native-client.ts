export function isNativeClient(value: unknown): boolean {
  return value === "native";
}

type NativeSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
};

/** Extra JSON fields for the iOS app. The website omits `client`, so its body stays unchanged. */
export function nativeAuthFields(
  client: unknown,
  session: NativeSession | null | undefined,
): { access_token: string; refresh_token: string; expires_at: number | null } | Record<string, never> {
  if (!isNativeClient(client) || !session?.access_token || !session.refresh_token) {
    return {};
  }
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
  };
}

/** Website magic links keep `{origin}/app`. The app may ask for its own callback. */
export function magicLinkRedirect(origin: string, requested: unknown): string {
  const fallback = `${origin.replace(/\/$/, "")}/app`;
  if (typeof requested !== "string" || !requested.trim()) return fallback;
  const value = requested.trim();
  if (value === "iplanetpay://auth-callback") return value;
  try {
    const url = new URL(value);
    const base = new URL(origin);
    if (url.origin === base.origin) return url.toString();
  } catch {
    return fallback;
  }
  return fallback;
}
