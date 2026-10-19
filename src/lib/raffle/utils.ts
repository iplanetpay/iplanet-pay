export const FICHA_CENTS = 10_000;
export const RAFFLE_MIN_PROGRESS_PCT = 30;
export const RAFFLE_ELIGIBILITY_MESSAGE =
  "Apenas será considerado a participação do sorteio caso esteja concluído 30% do valor de aportes.";

export function ticketsFromContributedCents(cents: number, perTicket = FICHA_CENTS) {
  return Math.floor(cents / perTicket);
}

export function reservationRaffleEligible(
  contributedCents: number,
  listPriceCents: number,
  minPct = RAFFLE_MIN_PROGRESS_PCT,
) {
  if (listPriceCents <= 0) return false;
  return contributedCents * 100 >= listPriceCents * minPct;
}

/** Cents still missing on the reservation to reach the raffle threshold. */
export function raffleEligibilityGapCents(
  contributedCents: number,
  listPriceCents: number,
  minPct = RAFFLE_MIN_PROGRESS_PCT,
) {
  if (listPriceCents <= 0) return 0;
  return Math.max(0, Math.ceil((listPriceCents * minPct) / 100) - contributedCents);
}

export type RaffleContribution = {
  userId: string;
  reservationId: string;
  amountCents: number;
};

export type RaffleReservation = { id: string; listPriceCents: number };

/** user id → raw fichas at the moment of a reset. */
export type RaffleTicketBaseline = Record<string, number>;

export type RaffleBalance = {
  userId: string;
  contributedCents: number;
  eligibleCents: number;
  eligible: boolean;
  rawTickets: number;
  tickets: number;
};

export function ticketsAfterBaseline(rawTickets: number, baseline = 0) {
  return Math.max(0, rawTickets - Math.max(0, baseline));
}

/**
 * Only confirmed contributions on reservations that reached the minimum
 * progress earn fichas. `baseline` comes from the active reset snapshot.
 */
export function computeRaffleBalances({
  contributions,
  reservations,
  baseline = {},
  perTicket = FICHA_CENTS,
  minPct = RAFFLE_MIN_PROGRESS_PCT,
}: {
  contributions: RaffleContribution[];
  reservations: RaffleReservation[];
  baseline?: RaffleTicketBaseline;
  perTicket?: number;
  minPct?: number;
}): RaffleBalance[] {
  const priceById = new Map(reservations.map((r) => [r.id, r.listPriceCents]));
  const byReservation = new Map<string, { userId: string; cents: number }>();
  for (const c of contributions) {
    const current = byReservation.get(c.reservationId);
    byReservation.set(c.reservationId, {
      userId: c.userId,
      cents: (current?.cents ?? 0) + c.amountCents,
    });
  }

  const byUser = new Map<string, { contributed: number; eligible: number }>();
  for (const [reservationId, { userId, cents }] of byReservation) {
    const totals = byUser.get(userId) ?? { contributed: 0, eligible: 0 };
    totals.contributed += cents;
    if (reservationRaffleEligible(cents, priceById.get(reservationId) ?? 0, minPct)) {
      totals.eligible += cents;
    }
    byUser.set(userId, totals);
  }

  return [...byUser.entries()].map(([userId, totals]) => {
    const rawTickets = ticketsFromContributedCents(totals.eligible, perTicket);
    return {
      userId,
      contributedCents: totals.contributed,
      eligibleCents: totals.eligible,
      eligible: totals.eligible > 0,
      rawTickets,
      tickets: ticketsAfterBaseline(rawTickets, baseline[userId] ?? 0),
    };
  });
}

export function raffleDrawPool(balances: RaffleBalance[]) {
  return balances.filter((b) => b.eligible && b.tickets > 0);
}

export function ticketBaselineSnapshot(balances: RaffleBalance[]): RaffleTicketBaseline {
  const snapshot: RaffleTicketBaseline = {};
  for (const b of balances) {
    if (b.rawTickets > 0) snapshot[b.userId] = b.rawTickets;
  }
  return snapshot;
}

export type RaffleTicketReset = {
  id: string;
  drawId: string | null;
  snapshot: RaffleTicketBaseline;
  createdAt: string;
  revertedAt: string | null;
};

/** The latest reset that was not reverted is the one offsetting fichas. */
export function activeTicketReset(resets: RaffleTicketReset[]): RaffleTicketReset | null {
  let active: RaffleTicketReset | null = null;
  for (const reset of resets) {
    if (reset.revertedAt) continue;
    if (!active || reset.createdAt > active.createdAt) active = reset;
  }
  return active;
}

export type RaffleResetState =
  | { kind: "awaiting_draw" }
  | { kind: "ready"; drawId: string }
  | { kind: "reset"; drawId: string; resetId: string };

export function raffleResetState({
  latestDrawId,
  activeReset,
}: {
  latestDrawId: string | null;
  activeReset: RaffleTicketReset | null;
}): RaffleResetState {
  if (!latestDrawId) return { kind: "awaiting_draw" };
  if (activeReset && activeReset.drawId === latestDrawId) {
    return { kind: "reset", drawId: latestDrawId, resetId: activeReset.id };
  }
  return { kind: "ready", drawId: latestDrawId };
}

export function daysUntilNextRaffle(from = new Date()) {
  const target = new Date(from);
  target.setMonth(from.getMonth() + 1);
  target.setDate(1);
  target.setHours(0, 0, 0, 0);
  if (target <= from) {
    target.setMonth(target.getMonth() + 1);
  }
  return Math.max(0, Math.ceil((target.getTime() - from.getTime()) / 86_400_000));
}

export function pickWeightedWinner(
  entries: Array<{ userId: string; name: string; tickets: number }>,
): { userId: string; name: string } | null {
  const pool = entries.filter((e) => e.tickets > 0);
  if (pool.length === 0) return null;
  const total = pool.reduce((s, e) => s + e.tickets, 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.tickets;
    if (r <= 0) return { userId: e.userId, name: e.name };
  }
  const last = pool[pool.length - 1];
  return { userId: last.userId, name: last.name };
}
