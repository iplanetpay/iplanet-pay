#!/usr/bin/env node
import assert from "node:assert/strict";
import { normalizeBrazilPhone } from "../src/lib/phone.ts";
import { ownerCanCancelReservation } from "../src/lib/reservations/cancel-policy.ts";
import { referralActivated } from "../src/lib/referrals/status.ts";
import { tradeInDaysRemaining, tradeInDecisionValue, tradeInVisual } from "../src/lib/trade-in/offer-state.ts";
import { productSubtitle } from "../src/lib/reservations/types.ts";
import {
  formatCpf,
  identityMissingMessage,
  normalizeCpf,
  normalizeState,
  profileIdentityComplete,
  signedInWithGoogle,
} from "../src/lib/profile/identity.ts";
import {
  isUploadedAvatar,
  resolveProfileAvatar,
  shouldSyncProviderAvatar,
} from "../src/lib/auth/avatar.ts";
import {
  couponNotice,
  nextRaffleDate,
  normalizeCouponCode,
  raffleDateNotice,
  unreadNoticeCount,
  winnerNotice,
} from "../src/lib/notices/copy.ts";

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

test("reservation subtitle leaves the store unit out", () => {
  const text = productSubtitle({
    id: "p",
    name: "iPhone 16",
    slug: "iphone-16",
    brand: "Apple",
    model: "iPhone 16",
    storage: "128 GB",
    color: "Azul",
    list_price_cents: 460000,
    image_url: null,
  });
  assert.equal(text, "128 GB · Azul");
  assert.equal(text.includes("Itaim"), false);
});

test("trade-in expiry counts down and reaches zero after 90 days", () => {
  const reviewed = new Date("2026-01-01T00:00:00.000Z").toISOString();
  const offer = {
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
  assert.equal(tradeInDaysRemaining(offer, new Date("2026-01-01T00:00:00.000Z").getTime()), 90);
  assert.equal(tradeInDaysRemaining(offer, new Date("2026-04-02T00:00:00.000Z").getTime()), 0);
});

test("approve uses the value the client informed and counter uses the admin value", () => {
  assert.equal(tradeInDecisionValue("approve", 200000, 150000), 200000);
  assert.equal(tradeInDecisionValue("approve", 200000, null), 200000);
  assert.equal(tradeInDecisionValue("counter", 200000, 150000), 150000);
  assert.equal(tradeInDecisionValue("reject", 200000, 150000), null);
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

test("signup identity requires cpf, phone, city, state, address, number and birth date", () => {
  assert.equal(normalizeCpf("390.533.447-05"), "39053344705");
  assert.equal(formatCpf("39053344705"), "390.533.447-05");
  assert.equal(normalizeCpf("111.111.111-11"), null);
  assert.equal(normalizeCpf("123"), null);
  assert.equal(normalizeState("sp"), "SP");
  assert.equal(normalizeState("XX"), null);
  const complete = {
    cpf: "390.533.447-05",
    phone: "11999999999",
    city: "São Paulo",
    state: "SP",
    address: "Rua A",
    addressNumber: "10",
    birthDate: "1990-05-20",
  };
  assert.equal(profileIdentityComplete(complete), true);
  assert.equal(profileIdentityComplete({ ...complete, cpf: "" }), false);
  assert.equal(profileIdentityComplete({ ...complete, state: "" }), false);
  assert.equal(profileIdentityComplete({ ...complete, addressNumber: "  " }), false);
  assert.equal(profileIdentityComplete({ ...complete, birthDate: "1890-01-01" }), false);
  assert.equal(
    identityMissingMessage({ ...complete, addressNumber: "" }),
    "Informe o número.",
  );
  assert.equal(signedInWithGoogle({ app_metadata: { provider: "google" } }), true);
  assert.equal(signedInWithGoogle({ app_metadata: { provider: "email" }, identities: [] }), false);
  assert.equal(
    signedInWithGoogle({ identities: [{ provider: "google" }] }),
    true,
  );
});

test("google avatar syncs until the user uploads a custom photo", () => {
  const google = "https://lh3.googleusercontent.com/a/photo";
  const uploaded = "https://xeeogfmmasvgbpmodqym.supabase.co/storage/v1/object/public/avatars/u/avatar.jpg";
  assert.equal(isUploadedAvatar(uploaded), true);
  assert.equal(isUploadedAvatar(google), false);
  assert.equal(resolveProfileAvatar(null, google), google);
  assert.equal(resolveProfileAvatar(uploaded, google), uploaded);
  assert.equal(shouldSyncProviderAvatar(null, google), true);
  assert.equal(shouldSyncProviderAvatar(google, "https://lh3.googleusercontent.com/a/new"), true);
  assert.equal(shouldSyncProviderAvatar(uploaded, google), false);
});

test("avisos: raffle date, winner and pre-created coupon", () => {
  const from = new Date(2026, 9, 15, 12, 0, 0);
  assert.equal(nextRaffleDate(from).getMonth(), 10);
  assert.equal(nextRaffleDate(from).getDate(), 1);
  const raffle = raffleDateNotice(from);
  assert.equal(raffle.kind, "sorteio");
  assert.equal(raffle.body.includes("01/11/2026"), true);
  assert.equal(winnerNotice("  ", 2), null);
  assert.equal(winnerNotice("Ana", 1)?.body, "Ana ganhou o sorteio com 1 ficha.");
  assert.equal(normalizeCouponCode(" ip 10 "), "IP10");
  assert.equal(normalizeCouponCode("código"), null);
  assert.equal(couponNotice("ip10", "Retirada")?.couponCode, "IP10");
  assert.equal(couponNotice("ab", "Retirada"), null);
  assert.equal(unreadNoticeCount([{ id: "a" }, { id: "b" }], ["b"]), 1);
});

console.log(`\n${passed} test(s) passed.`);
