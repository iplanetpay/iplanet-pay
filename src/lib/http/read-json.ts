/**
 * An error page (HTML) makes `res.json()` throw: Safari says "The string did not match
 * the expected pattern", Chrome "Unexpected token <". Turn that into a normal failure.
 */
export async function readJson<T extends { ok?: boolean; error?: string }>(
  res: Response,
): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return { ok: false, error: `Resposta inválida do servidor (HTTP ${res.status}).` } as T;
  }
}
