type AuthIdentity = {
  provider?: string;
  identity_data?: Record<string, unknown> | null;
};

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("https://")) return null;
  return trimmed;
}

/** Google (and other OAuth) stores the photo as avatar_url or picture. */
export function avatarFromAuthMetadata(user: {
  user_metadata?: Record<string, unknown> | null;
  identities?: AuthIdentity[] | null;
}): string | null {
  const meta = user.user_metadata ?? {};
  const fromMeta = httpsUrl(meta.avatar_url) ?? httpsUrl(meta.picture);
  if (fromMeta) return fromMeta;

  for (const identity of user.identities ?? []) {
    if (identity.provider && identity.provider !== "google") continue;
    const data = identity.identity_data ?? {};
    const url = httpsUrl(data.avatar_url) ?? httpsUrl(data.picture);
    if (url) return url;
  }

  return null;
}

/** A photo chosen in settings wins. Otherwise use the provider photo. */
export function resolveProfileAvatar(
  stored: string | null | undefined,
  fromProvider: string | null,
): string | null {
  const trimmed = stored?.trim() || null;
  return trimmed ?? fromProvider;
}
