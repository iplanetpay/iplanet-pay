/** "cobranca_lembrete" → "Cobranca Lembrete", only for display. */
export function templateLabel(name: string) {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

/**
 * The cron looks templates up by their stored name, so saving the display label back
 * would rename "cobranca_lembrete" to "Cobranca Lembrete". Only a real edit renames.
 */
export function templateNamePatch(storedName: string, editedName: string): string | undefined {
  const edited = editedName.trim();
  if (!edited || edited === templateLabel(storedName) || edited === storedName) return undefined;
  return edited;
}
