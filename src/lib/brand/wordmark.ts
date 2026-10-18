/** Cropped wordmark is 1175×296. Both axes stay explicit for next/image. */
const WORDMARK_ASPECT = 1175 / 296;

export function wordmarkBox(height: number): { width: number; height: number } {
  return {
    height,
    width: Math.round(height * WORDMARK_ASPECT),
  };
}
