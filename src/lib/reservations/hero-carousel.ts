/** Mirrors the catalog: arrows only once there is another reservation to switch to. */
export function showReservationArrows(count: number): boolean {
  return count > 1;
}

/** Wraps around in both directions so rapid taps chain past the ends. */
export function stepReservationIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}

export function reservationKeyDelta(key: string): -1 | 0 | 1 {
  if (key === "ArrowLeft") return -1;
  if (key === "ArrowRight") return 1;
  return 0;
}
