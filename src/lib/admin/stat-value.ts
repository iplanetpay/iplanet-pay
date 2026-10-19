const MIN_REM = 1.125;
const DEFAULT_MAX_REM = 2.25;
/** Average bold glyph width in em, with margin, used to fit the value to the card width. */
const GLYPH_EM = 0.58;

/**
 * Font size for a stat value that always fits its card: the size scales with the
 * card's inline size (`cqi`, the card must be an `@container`) and the number of
 * characters, never above `maxRem` and never below a readable minimum.
 */
export function statValueFontSize(value: string, maxRem = DEFAULT_MAX_REM): string {
  const chars = Math.max(1, [...value.trim()].length);
  const fit = Number((100 / (chars * GLYPH_EM)).toFixed(2));
  return `clamp(${MIN_REM}rem, ${fit}cqi, ${Math.max(MIN_REM, maxRem)}rem)`;
}

export const STAT_GRID_4 = "grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4";
export const STAT_GRID_3 = "grid grid-cols-1 gap-4 min-[480px]:grid-cols-3";
