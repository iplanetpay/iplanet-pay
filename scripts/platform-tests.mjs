#!/usr/bin/env node
import assert from "node:assert/strict";
import { normalizeBrazilPhone } from "../src/lib/phone.ts";
import { ownerCanCancelReservation } from "../src/lib/reservations/cancel-policy.ts";
import { referralActivated } from "../src/lib/referrals/status.ts";
import { tradeInVisual } from "../src/lib/trade-in/offer-state.ts";

function ticketsFromContributedCents(cents, perTicket = 10_000) {
  return Math.floor(cents / perTicket);
}

function pickWeightedWinner(entries) {
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

function daysUntilNextRaffle(from = new Date()) {
  const target = new Date(from);
  target.setMonth(from.getMonth() + 1);
  target.setDate(1);
  target.setHours(0, 0, 0, 0);
  if (target <= from) target.setMonth(target.getMonth() + 1);
  return Math.max(0, Math.ceil((target.getTime() - from.getTime()) / 86_400_000));
}

function calcWithdrawalAmounts(totalPaidCents, feePct = 30) {
  const fee = Math.round((totalPaidCents * feePct) / 100);
  return { fee_amount_cents: fee, refund_amount_cents: totalPaidCents - fee };
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

test("fichas: R$100 = 1 ticket", () => {
  assert.equal(ticketsFromContributedCents(0), 0);
  assert.equal(ticketsFromContributedCents(9999), 0);
  assert.equal(ticketsFromContributedCents(10000), 1);
  assert.equal(ticketsFromContributedCents(25000), 2);
});

test("sorteio: weighted winner from pool", () => {
  const w = pickWeightedWinner([
    { userId: "a", name: "A", tickets: 1 },
    { userId: "b", name: "B", tickets: 99 },
  ]);
  assert.ok(w);
  assert.ok(["a", "b"].includes(w.userId));
});

test("days until raffle is non-negative", () => {
  assert.ok(daysUntilNextRaffle() >= 0);
});

test("withdrawal 70/30 split", () => {
  const { fee_amount_cents, refund_amount_cents } = calcWithdrawalAmounts(100000, 30);
  assert.equal(fee_amount_cents, 30000);
  assert.equal(refund_amount_cents, 70000);
});

test("cancel stays allowed when the reservation already has aportes", () => {
  assert.equal(ownerCanCancelReservation(true, "ativa", 460_000), true);
  assert.equal(ownerCanCancelReservation(true, "ativa", 0), true);
  assert.equal(ownerCanCancelReservation(false, "ativa", 0), false);
  assert.equal(ownerCanCancelReservation(true, "cancelada", 100), false);
});

test("local WhatsApp numbers gain the 55 prefix", () => {
  assert.equal(normalizeBrazilPhone("11 97063-8924"), "5511970638924");
  assert.equal(normalizeBrazilPhone("5511970638924"), "5511970638924");
  assert.equal(normalizeBrazilPhone(""), null);
});

test("referral stays pending until R$100 and turns active at the threshold", () => {
  assert.equal(referralActivated(0, false), false);
  assert.equal(referralActivated(9999, false), false);
  assert.equal(referralActivated(10000, false), true);
  assert.equal(referralActivated(0, true), true);
});

test("approved trade-in credit expires after 90 days and stays hidden once discarded", () => {
  const reviewed = new Date("2026-01-01T00:00:00.000Z").toISOString();
  const base = {
    id: "o",
    user_id: "u",
    reservation_id: "r",
    device_model: "iPhone",
    imei: "1",
    expected_value_cents: 200000,
    minimum_value_cents: 200000,
    maintenance_options: [],
    liquid_exposure: false,
    photo_paths: [],
    status: "approved",
    admin_message: null,
    approved_value_cents: 200000,
    reviewed_at: reviewed,
    created_at: reviewed,
  };
  const active = tradeInVisual(base, new Date("2026-02-01T00:00:00.000Z").getTime());
  assert.equal(active.expired, false);
  assert.equal(active.tone, "yellow");
  assert.equal(active.creditCents, 200000);
  const expired = tradeInVisual(base, new Date("2026-04-02T00:00:00.000Z").getTime());
  assert.equal(expired.expired, true);
  assert.equal(expired.tone, "red");
  const discarded = tradeInVisual(
    { ...base, admin_message: "DESCARTADA|expirada" },
    new Date("2026-04-02T00:00:00.000Z").getTime(),
  );
  assert.equal(discarded.discarded, true);
  assert.equal(discarded.creditCents, 0);
});

console.log(`\n${passed} test(s) passed.`);
