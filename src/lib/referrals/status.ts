/** Minimum confirmed contribution that activates a referral and pays the referrer bonus. */
export const REFERRAL_ACTIVATION_CENTS = 10_000;

export function referralActivated(confirmedCents: number, bonusCredited: boolean): boolean {
  return confirmedCents >= REFERRAL_ACTIVATION_CENTS || bonusCredited;
}
