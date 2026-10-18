/** Mock auth has no Supabase server client. Skip the write instead of throwing. */
export function analyticsPersistMode(useMockAuth: boolean): "skip" | "write" {
  if (useMockAuth) return "skip";
  return "write";
}
