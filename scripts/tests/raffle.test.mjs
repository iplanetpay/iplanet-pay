import assert from "node:assert/strict";
import {
  activeTicketReset,
  computeRaffleBalances,
  raffleDrawPool,
  raffleEligibilityGapCents,
  raffleResetState,
  reservationRaffleEligible,
  ticketBaselineSnapshot,
  ticketsAfterBaseline,
  ticketsFromContributedCents,
} from "../../src/lib/raffle/utils.ts";

const reservations = [
  { id: "r-ana", listPriceCents: 1_000_000 },
  { id: "r-beto", listPriceCents: 1_000_000 },
  { id: "r-caio", listPriceCents: 500_000 },
];

function balanceOf(balances, userId) {
  return balances.find((b) => b.userId === userId);
}

export default function suite(test) {
  test("raffle: 29.9% of the device price earns 0 fichas and stays out of the draw", () => {
    assert.equal(reservationRaffleEligible(299_000, 1_000_000), false);
    assert.equal(raffleEligibilityGapCents(299_000, 1_000_000), 1_000);
    const balances = computeRaffleBalances({
      contributions: [{ userId: "beto", reservationId: "r-beto", amountCents: 299_000 }],
      reservations,
    });
    const beto = balanceOf(balances, "beto");
    assert.equal(beto.contributedCents, 299_000);
    assert.equal(beto.eligible, false);
    assert.equal(beto.tickets, 0);
    assert.deepEqual(raffleDrawPool(balances), []);
  });

  test("raffle: exactly 30% is eligible and keeps R$100 = 1 ficha", () => {
    assert.equal(reservationRaffleEligible(300_000, 1_000_000), true);
    assert.equal(raffleEligibilityGapCents(300_000, 1_000_000), 0);
    assert.equal(reservationRaffleEligible(0, 0), false);
    const balances = computeRaffleBalances({
      contributions: [
        { userId: "ana", reservationId: "r-ana", amountCents: 200_000 },
        { userId: "ana", reservationId: "r-ana", amountCents: 100_000 },
      ],
      reservations,
    });
    const ana = balanceOf(balances, "ana");
    assert.equal(ana.eligible, true);
    assert.equal(ana.tickets, ticketsFromContributedCents(300_000));
    assert.equal(ana.tickets, 30);
    assert.deepEqual(raffleDrawPool(balances).map((b) => b.userId), ["ana"]);
  });

  test("raffle: only reservations past 30% count toward a client's fichas", () => {
    const balances = computeRaffleBalances({
      contributions: [
        { userId: "ana", reservationId: "r-ana", amountCents: 400_000 },
        { userId: "ana", reservationId: "r-caio", amountCents: 100_000 },
      ],
      reservations,
    });
    const ana = balanceOf(balances, "ana");
    assert.equal(ana.contributedCents, 500_000);
    assert.equal(ana.eligibleCents, 400_000);
    assert.equal(ana.tickets, 40);
  });

  test("raffle: zerar fichas sets every balance to 0 and new aportes count again", () => {
    const contributions = [
      { userId: "ana", reservationId: "r-ana", amountCents: 450_000 },
      { userId: "caio", reservationId: "r-caio", amountCents: 250_000 },
      { userId: "beto", reservationId: "r-beto", amountCents: 100_000 },
    ];
    const before = computeRaffleBalances({ contributions, reservations });
    const snapshot = ticketBaselineSnapshot(before);
    assert.deepEqual(snapshot, { ana: 45, caio: 25 });

    const reset = {
      id: "reset-1",
      drawId: "draw-1",
      snapshot,
      createdAt: "2026-11-01T12:00:00.000Z",
      revertedAt: null,
    };
    const after = computeRaffleBalances({
      contributions,
      reservations,
      baseline: activeTicketReset([reset]).snapshot,
    });
    assert.equal(after.every((b) => b.tickets === 0), true);
    assert.deepEqual(raffleDrawPool(after), []);

    const later = computeRaffleBalances({
      contributions: [
        ...contributions,
        { userId: "ana", reservationId: "r-ana", amountCents: 20_000 },
      ],
      reservations,
      baseline: snapshot,
    });
    assert.equal(balanceOf(later, "ana").tickets, 2);
    assert.equal(ticketsAfterBaseline(3, 5), 0);
  });

  test("raffle: reverter restores exactly the fichas from before the reset", () => {
    const contributions = [
      { userId: "ana", reservationId: "r-ana", amountCents: 450_000 },
      { userId: "caio", reservationId: "r-caio", amountCents: 250_000 },
    ];
    const first = {
      id: "reset-1",
      drawId: "draw-1",
      snapshot: { ana: 40 },
      createdAt: "2026-10-01T12:00:00.000Z",
      revertedAt: null,
    };
    const tickets = (resets) =>
      computeRaffleBalances({
        contributions,
        reservations,
        baseline: activeTicketReset(resets)?.snapshot ?? {},
      }).map((b) => [b.userId, b.tickets]);

    const beforeSecond = tickets([first]);
    assert.deepEqual(beforeSecond, [["ana", 5], ["caio", 25]]);

    const second = {
      id: "reset-2",
      drawId: "draw-2",
      snapshot: ticketBaselineSnapshot(
        computeRaffleBalances({ contributions, reservations, baseline: first.snapshot }),
      ),
      createdAt: "2026-11-01T12:00:00.000Z",
      revertedAt: null,
    };
    assert.deepEqual(tickets([first, second]), [["ana", 0], ["caio", 0]]);

    const reverted = { ...second, revertedAt: "2026-11-01T12:05:00.000Z" };
    assert.equal(activeTicketReset([first, reverted]).id, "reset-1");
    assert.deepEqual(tickets([first, reverted]), beforeSecond);
    assert.deepEqual(tickets([{ ...first, revertedAt: "2026-10-01T13:00:00.000Z" }]), [
      ["ana", 45],
      ["caio", 25],
    ]);
  });

  test("raffle: Zerar Fichas is enabled only after a draw and Reverter only after a reset", () => {
    assert.deepEqual(raffleResetState({ latestDrawId: null, activeReset: null }), {
      kind: "awaiting_draw",
    });
    assert.deepEqual(raffleResetState({ latestDrawId: "draw-1", activeReset: null }), {
      kind: "ready",
      drawId: "draw-1",
    });
    const reset = {
      id: "reset-1",
      drawId: "draw-1",
      snapshot: {},
      createdAt: "2026-11-01T12:00:00.000Z",
      revertedAt: null,
    };
    assert.deepEqual(raffleResetState({ latestDrawId: "draw-1", activeReset: reset }), {
      kind: "reset",
      drawId: "draw-1",
      resetId: "reset-1",
    });
    assert.deepEqual(raffleResetState({ latestDrawId: "draw-2", activeReset: reset }), {
      kind: "ready",
      drawId: "draw-2",
    });
  });
}
