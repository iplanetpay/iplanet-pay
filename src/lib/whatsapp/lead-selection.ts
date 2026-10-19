import { normalizeBrazilPhone } from "../phone.ts";

/** Brazilian numbers with 55 in front, deduplicated, in selection order. Invalid numbers are dropped. */
export function selectedLeadPhones(phones: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of phones) {
    const phone = normalizeBrazilPhone(raw);
    if (!phone || !phone.startsWith("55")) continue;
    if (phone.length < 12 || phone.length > 13) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);
    out.push(phone);
  }
  return out;
}

export function formatLeadPhoneList(phones: readonly (string | null | undefined)[]): string {
  return selectedLeadPhones(phones).join(", ");
}

export function toggleLeadSelection(
  selected: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** "Selecionar todos" selects every lead; when all are already selected it clears. */
export function toggleAllLeads(
  selected: ReadonlySet<string>,
  ids: readonly string[],
): Set<string> {
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  return allSelected ? new Set() : new Set(ids);
}
