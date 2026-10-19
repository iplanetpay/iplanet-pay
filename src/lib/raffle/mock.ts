import { MOCK_USERS } from "@/lib/auth/mock";
import { mockListRecent } from "@/lib/reservations/mock";
import { mockAllContributions } from "@/lib/wallet/mock-contributions";
import type {
  RaffleContribution,
  RaffleReservation,
  RaffleTicketBaseline,
  RaffleTicketReset,
} from "@/lib/raffle/utils";

export type MockRaffleDraw = {
  id: string;
  winnerUserId: string;
  winnerName: string;
  drawnAt: string;
};

type MockResetRecord = RaffleTicketReset & { usersCount: number; totalTickets: number };

type MockRaffleState = { draws: MockRaffleDraw[]; resets: MockResetRecord[] };

/** Demo participants so the mock draw has a pool; Diego sits at 29.9% and stays out. */
const DEMO_PARTICIPANTS = [
  { userId: "demo-bruno", name: "Bruno Demo", listPriceCents: 500_000, paidCents: 250_000 },
  { userId: "demo-carla", name: "Carla Demo", listPriceCents: 800_000, paidCents: 640_000 },
  { userId: "demo-diego", name: "Diego Demo", listPriceCents: 1_000_000, paidCents: 299_000 },
];

function state(): MockRaffleState {
  const scope = globalThis as typeof globalThis & { __iplanetMockRaffle?: MockRaffleState };
  if (!scope.__iplanetMockRaffle) {
    scope.__iplanetMockRaffle = { draws: [], resets: [] };
  }
  return scope.__iplanetMockRaffle;
}

export function mockRaffleSource(): {
  contributions: RaffleContribution[];
  reservations: RaffleReservation[];
  names: Map<string, string>;
} {
  const names = new Map<string, string>(
    Object.values(MOCK_USERS).map((u) => [u.id, u.full_name]),
  );
  const reservations: RaffleReservation[] = mockListRecent(Number.MAX_SAFE_INTEGER).map((r) => ({
    id: r.id,
    listPriceCents: r.list_price_cents,
  }));
  const contributions: RaffleContribution[] = mockAllContributions()
    .filter((c) => c.status === "confirmed")
    .map((c) => ({ userId: c.user_id, reservationId: c.reservation_id, amountCents: c.amount_cents }));

  for (const demo of DEMO_PARTICIPANTS) {
    const reservationId = `${demo.userId}-reserva`;
    names.set(demo.userId, demo.name);
    reservations.push({ id: reservationId, listPriceCents: demo.listPriceCents });
    contributions.push({ userId: demo.userId, reservationId, amountCents: demo.paidCents });
  }

  return { contributions, reservations, names };
}

export function mockLatestDraw(): MockRaffleDraw | null {
  return state().draws.at(-1) ?? null;
}

export function mockRecordDraw(winnerUserId: string, winnerName: string): MockRaffleDraw {
  const draw: MockRaffleDraw = {
    id: globalThis.crypto.randomUUID(),
    winnerUserId,
    winnerName,
    drawnAt: new Date().toISOString(),
  };
  state().draws.push(draw);
  return draw;
}

export function mockResets(): MockResetRecord[] {
  return state().resets;
}

export function mockCreateReset(
  drawId: string,
  snapshot: RaffleTicketBaseline,
  usersCount: number,
  totalTickets: number,
): MockResetRecord {
  const reset: MockResetRecord = {
    id: globalThis.crypto.randomUUID(),
    drawId,
    snapshot,
    createdAt: new Date().toISOString(),
    revertedAt: null,
    usersCount,
    totalTickets,
  };
  state().resets.push(reset);
  return reset;
}

export function mockRevertReset(resetId: string): boolean {
  const reset = state().resets.find((r) => r.id === resetId && !r.revertedAt);
  if (!reset) return false;
  reset.revertedAt = new Date().toISOString();
  return true;
}
