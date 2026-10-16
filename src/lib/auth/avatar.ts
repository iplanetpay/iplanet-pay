type AuthIdentity = {
  provider?: string;
  identity_data?: Record<string, unknown> | null;
};

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) return null;
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

/** Foto enviada nas configurações (storage ou data URL). */
export function isUploadedAvatar(url: string | null | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  if (value.startsWith("data:image")) return true;
  return value.includes("/avatars/") || value.includes("/storage/v1/object/");
}

/** Foto do Google (ou outro provedor) quando ainda não há upload próprio. */
export function resolveProfileAvatar(
  stored: string | null | undefined,
  fromProvider: string | null,
): string | null {
  const trimmed = stored?.trim() || null;
  if (trimmed && isUploadedAvatar(trimmed)) return trimmed;
  return fromProvider ?? trimmed;
}

/** Atualiza o perfil com a foto do Google se ainda não houver upload próprio. */
export function shouldSyncProviderAvatar(
  stored: string | null | undefined,
  fromProvider: string | null,
): boolean {
  if (!fromProvider) return false;
  const trimmed = stored?.trim() || "";
  if (!trimmed) return true;
  if (isUploadedAvatar(trimmed)) return false;
  return trimmed !== fromProvider;
}
