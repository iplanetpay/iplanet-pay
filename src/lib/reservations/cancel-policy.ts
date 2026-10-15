/** Active reservations can be cancelled with a paid balance. That cash returns to the wallet. */
export function ownerCanCancelReservation(
  isOwner: boolean,
  status: string,
  amountPaidCents: number,
): boolean {
  if (!isOwner || status !== "ativa") return false;
  return amountPaidCents >= 0;
}
