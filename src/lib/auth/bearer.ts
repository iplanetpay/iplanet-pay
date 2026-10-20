/**
 * User access tokens from the iOS app are JWTs (three base64url segments).
 * Cron and other service callers also send `Authorization: Bearer …`, but
 * those secrets are not JWTs. Only a JWT switches the server client off cookies.
 */
const BEARER = /^Bearer\s+(\S+)$/i;

export function parseBearerAuthorization(
  header: string | null | undefined,
): string | null {
  if (!header) return null;
  const match = BEARER.exec(header.trim());
  const token = match?.[1];
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return null;
  return token;
}
