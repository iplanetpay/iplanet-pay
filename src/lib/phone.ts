/** Digits only, with Brazil country code 55 when the user typed a local number. */
export function normalizeBrazilPhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let digits = String(raw).replace(/\D/g, "").replace(/^0+/, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}
