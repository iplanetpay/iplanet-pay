/**
 * Safari on macOS, or any browser on iPhone/iPad (all of them run WebKit).
 * iPadOS reports a Mac user agent, so callers pass maxTouchPoints too.
 */
export function isWebKitSafari(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return true;
  if (!/Safari\//i.test(userAgent)) return false;
  return !/Chrome|Chromium|CriOS|Edg\/|OPR\/|Firefox|FxiOS|Android/i.test(userAgent);
}
