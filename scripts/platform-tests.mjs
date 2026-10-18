#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
import { analyticsPersistMode } from "../src/lib/analytics/persist.ts";
import { resolveSignupAccess } from "../src/lib/auth/signup-access.ts";
import { wordmarkBox } from "../src/lib/brand/wordmark.ts";
import { showCatalogStepArrows } from "../src/lib/catalog/carousel-arrows.ts";
import { CHOOSE_TILES } from "../src/lib/landing/choose-tiles.ts";
import { videoBlocksBoot } from "../src/lib/navigation/boot-media.ts";
import { isWebKitSafari } from "../src/lib/browser/webkit.ts";
import {
  STORY_FADE,
  activeStoryStep,
  holdRange,
  nearestRestingProgress,
  phoneShellTilt,
  presenceKeyframes,
  storySegments,
} from "../src/lib/landing/story-timeline.ts";
import {
  couponNotice,
  nextRaffleDate,
  normalizeCouponCode,
  raffleDateNotice,
  unreadNoticeCount,
  winnerNotice,
} from "../src/lib/notices/copy.ts";
import {
  applyEarlyPayments,
  assignContributionStatuses,
  buildContributionPlan,
  nextOpenAporteCents,
} from "../src/lib/reservations/contribution-plan.ts";
import {
  calendarMarks,
  defaultMonthIndex,
  planMonthKeys,
  resolveContributionSlots,
  stepMonthIndex,
} from "../src/lib/goals/calendar-marks.ts";
import {
  climbMotion,
  dayPhase,
  goalHealth,
  journeyWeather,
  mapOpenWeather,
  previewScene,
  ropeMark,
  ropePoints,
  suppliesFor,
} from "../src/lib/goals/journey.ts";
import { contributionReminder } from "../src/lib/goals/reminders.ts";
import { CLIENTE_DOCK } from "../src/lib/navigation/cliente-dock.ts";
import { climbGoalFromPlan, prizeKindFromProductName } from "../src/lib/goals/climb/adapter.ts";
import {
  brl,
  climbDaysLate,
  climbStreak,
  deriveStatus,
  relativeDue,
} from "../src/lib/goals/climb/goal-logic.ts";

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

test("signup does not ask for email confirmation when the server already confirmed", () => {
  assert.equal(
    resolveSignupAccess({ hasSession: false, autoConfirmed: false }).needsEmailConfirmation,
    true,
  );
  assert.equal(
    resolveSignupAccess({ hasSession: true, autoConfirmed: false }).needsEmailConfirmation,
    false,
  );
  assert.equal(
    resolveSignupAccess({ hasSession: false, autoConfirmed: true }).needsEmailConfirmation,
    false,
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

test("hero video with a poster never holds the landing boot overlay on iOS Safari", () => {
  const iosBeforePlay = { hasError: false, readyState: 1 };
  assert.equal(videoBlocksBoot({ ...iosBeforePlay, optional: true }), false);
  assert.equal(videoBlocksBoot({ ...iosBeforePlay, optional: false }), true);
  assert.equal(videoBlocksBoot({ optional: false, hasError: false, readyState: 3 }), false);
  assert.equal(videoBlocksBoot({ optional: false, hasError: true, readyState: 0 }), false);
});

test("Safari and every iOS browser are detected as WebKit, Chrome is not", () => {
  const macSafari =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
  const macChrome =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
  const iphoneChrome =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1";
  const androidChrome =
    "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36";
  assert.equal(isWebKitSafari(macSafari), true);
  assert.equal(isWebKitSafari(macChrome), false);
  assert.equal(isWebKitSafari(iphoneChrome), true);
  assert.equal(isWebKitSafari(androidChrome), false);
  assert.equal(isWebKitSafari(macSafari.replace("Version/26.0 ", ""), 5), true);
});

test("device mockup quality is listed in next image qualities", () => {
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  const mockup = readFileSync(
    new URL("../src/components/landing/framer-device-mockup.tsx", import.meta.url),
    "utf8",
  );
  const used = [...mockup.matchAll(/quality=\{(\d+)\}/g)].map((match) => Number(match[1]));
  assert.ok(used.includes(85));
  const list = config.match(/qualities:\s*\[([^\]]+)\]/);
  assert.ok(list);
  const configured = list[1].split(",").map((part) => Number(part.trim()));
  assert.ok(configured.includes(75));
  for (const quality of used) {
    assert.ok(configured.includes(quality));
  }
});

test("wordmark sets both image axes so Next does not warn about one resized side", () => {
  const box = wordmarkBox(44);
  assert.equal(box.height, 44);
  assert.equal(box.width, Math.round(44 * (1175 / 296)));
  assert.equal(typeof box.width, "number");
  const logo = readFileSync(
    new URL("../src/components/ui/brand-logo.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(logo.includes('width: "auto"'), false);
  assert.match(logo, /style=\{box\}|style=\{\{ \.\.\.box/);
});

test("lazy landing images ignore the Chrome loading attribute mismatch", () => {
  const section = readFileSync(
    new URL("../src/components/landing/seu-iphone-section.tsx", import.meta.url),
    "utf8",
  );
  const logo = readFileSync(
    new URL("../src/components/ui/brand-logo.tsx", import.meta.url),
    "utf8",
  );
  assert.match(section, /suppressHydrationWarning/);
  assert.match(logo, /suppressHydrationWarning/);
});

test("analytics does not throw when auth is mocked", () => {
  assert.equal(analyticsPersistMode(true), "skip");
  assert.equal(analyticsPersistMode(false), "write");
  const route = readFileSync(
    new URL("../src/app/api/analytics/track/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /analyticsPersistMode\(USE_MOCK_AUTH\) === "skip"/);
});

test("step 1 of Como funciona shows a photo on iPad Air and MacBook Air", () => {
  const names = CHOOSE_TILES.map((tile) => tile.name);
  assert.deepEqual(names, ["iPad Air", "MacBook Air"]);
  for (const tile of CHOOSE_TILES) {
    assert.match(tile.src, /^\/products\/.+\.(jpg|png|webp)$/);
    assert.equal(existsSync(`public${tile.src}`), true);
  }
});

test("catalog carousel keeps the next arrow on web and mobile when another model exists", () => {
  assert.equal(showCatalogStepArrows(1), false);
  assert.equal(showCatalogStepArrows(2), true);
  assert.equal(showCatalogStepArrows(28), true);
});

test("mobile Como funciona shows one step at a time and never rests mid cross-fade", () => {
  const count = 3;
  const segments = storySegments(count);
  const half = STORY_FADE / 2;
  for (let i = 0; i < count - 1; i++) {
    const out = presenceKeyframes(i, count).input;
    const into = presenceKeyframes(i + 1, count).input;
    assert.equal(out[2], into[0]);
    assert.equal(out[3], into[1]);
  }
  assert.deepEqual(presenceKeyframes(2, count).output, [0, 1, 1]);
  for (let i = 0; i < count; i++) {
    const [a, b] = holdRange(i, count);
    assert.ok(b > a);
    assert.equal(activeStoryStep((a + b) / 2, count), i);
    assert.equal(nearestRestingProgress((a + b) / 2, count), null);
  }
  const boundary = segments[0].end;
  const back = nearestRestingProgress(boundary - half / 2, count);
  const forward = nearestRestingProgress(boundary + half / 2, count);
  assert.ok(back < boundary - half);
  assert.ok(forward > boundary + half);
  assert.equal(nearestRestingProgress(back, count), null);
  assert.equal(nearestRestingProgress(forward, count), null);
  assert.equal(nearestRestingProgress(0, count), null);
  assert.equal(nearestRestingProgress(1, count), null);
  const [lastHoldStart, lastHoldEnd] = holdRange(count - 1, count);
  assert.equal(phoneShellTilt(lastHoldStart), 0);
  assert.equal(phoneShellTilt(lastHoldEnd), 0);
  assert.equal(phoneShellTilt(1), 0);
  assert.notEqual(phoneShellTilt(1), 14);
});

test("daily contributions count each day from the start through the deadline", () => {
  const plan = buildContributionPlan({
    targetCents: 400,
    contributedCents: 0,
    startDate: "2026-01-01",
    endDate: "2026-01-04",
    frequency: "daily",
  });
  assert.deepEqual(plan.dates, [
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
  ]);
  assert.equal(plan.installmentCount, 4);
  assert.equal(plan.amountPerInstallmentCents, 100);
  assert.equal(plan.lastInstallmentCents, 100);
});

test("weekly contributions land every seven days through the deadline", () => {
  const plan = buildContributionPlan({
    targetCents: 400,
    contributedCents: 0,
    startDate: "2026-01-01",
    endDate: "2026-01-29",
    frequency: "weekly",
  });
  assert.deepEqual(plan.dates, [
    "2026-01-01",
    "2026-01-08",
    "2026-01-15",
    "2026-01-22",
    "2026-01-29",
  ]);
  assert.equal(plan.installmentCount, 5);
  assert.equal(plan.amountPerInstallmentCents, 80);
});

test("monthly contributions step one month through the deadline", () => {
  const plan = buildContributionPlan({
    targetCents: 300,
    contributedCents: 0,
    startDate: "2026-01-10",
    endDate: "2026-04-10",
    frequency: "monthly",
  });
  assert.deepEqual(plan.dates, [
    "2026-01-10",
    "2026-02-10",
    "2026-03-10",
    "2026-04-10",
  ]);
  assert.equal(plan.installmentCount, 4);
});

test("plan uses the remaining balance after prior aportes", () => {
  const plan = buildContributionPlan({
    targetCents: 100_000,
    contributedCents: 40_000,
    startDate: "2026-03-01",
    endDate: "2026-03-04",
    frequency: "daily",
  });
  assert.equal(plan.remainingCents, 60_000);
  assert.equal(plan.installmentCount, 4);
  assert.equal(plan.amountPerInstallmentCents, 15_000);
  const sum =
    plan.amountPerInstallmentCents * (plan.installmentCount - 1) +
    plan.lastInstallmentCents;
  assert.equal(sum, 60_000);
});

test("last installment absorbs the cent remainder", () => {
  const plan = buildContributionPlan({
    targetCents: 100,
    contributedCents: 0,
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    frequency: "daily",
  });
  assert.deepEqual(plan.dates, ["2026-05-01", "2026-05-02", "2026-05-03"]);
  assert.equal(plan.installmentCount, 3);
  assert.equal(plan.amountPerInstallmentCents, 33);
  assert.equal(plan.lastInstallmentCents, 34);
  assert.equal(33 + 33 + 34, plan.remainingCents);
});

test("an early extra payment reduces the next aporte and does not go negative", () => {
  const installments = [
    { dueDate: "2026-11-01", amountCents: 10000 },
    { dueDate: "2026-12-01", amountCents: 10000 },
    { dueDate: "2027-01-01", amountCents: 10000 },
  ];

  const early = applyEarlyPayments({
    installments,
    contributions: [{ paidOn: "2026-10-15", amountCents: 15000 }],
  });
  assert.equal(early[0].paid, true);
  assert.equal(early[0].dueCents, 0);
  assert.equal(early[1].paid, false);
  assert.equal(early[1].dueCents, 5000);
  assert.equal(early[1].antecipado, true);
  assert.equal(early[2].dueCents, 10000);
  assert.equal(early[2].paid, false);
  assert.equal(nextOpenAporteCents(early), 5000);

  const larger = applyEarlyPayments({
    installments,
    contributions: [{ paidOn: "2026-10-15", amountCents: 25000 }],
  });
  assert.equal(larger[0].paid, true);
  assert.equal(larger[0].dueCents, 0);
  assert.equal(larger[1].paid, true);
  assert.equal(larger[1].dueCents, 0);
  assert.equal(larger[2].paid, false);
  assert.equal(larger[2].dueCents, 5000);
  assert.equal(nextOpenAporteCents(larger), 5000);

  const exact = applyEarlyPayments({
    installments,
    contributions: [{ paidOn: "2026-11-01", amountCents: 10000 }],
  });
  assert.equal(exact[0].paid, true);
  assert.equal(exact[1].dueCents, 10000);
  assert.equal(exact[1].antecipado, false);
  assert.equal(exact[2].dueCents, 10000);
  assert.equal(nextOpenAporteCents(exact), 10000);

  const overflow = applyEarlyPayments({
    installments,
    contributions: [{ paidOn: "2026-10-01", amountCents: 50000 }],
  });
  assert.deepEqual(
    overflow.map((row) => row.dueCents),
    [0, 0, 0],
  );
  assert.equal(overflow.every((row) => row.paid && row.dueCents >= 0), true);
  assert.equal(nextOpenAporteCents(overflow), null);
});

test("monthly plan includes the start date and rejects an end that is not after it", () => {
  const plan = buildContributionPlan({
    targetCents: 300,
    contributedCents: 0,
    startDate: "2026-11-01",
    endDate: "2027-01-01",
    frequency: "monthly",
  });
  assert.deepEqual(plan.dates, ["2026-11-01", "2026-12-01", "2027-01-01"]);
  assert.equal(plan.dates[0], "2026-11-01");
  assert.equal(plan.dates.at(-1), "2027-01-01");
  assert.throws(
    () =>
      buildContributionPlan({
        targetCents: 300,
        contributedCents: 0,
        startDate: "2026-11-01",
        endDate: "2026-11-01",
        frequency: "monthly",
      }),
    /depois do início/,
  );
  assert.throws(
    () =>
      buildContributionPlan({
        targetCents: 300,
        contributedCents: 0,
        startDate: "2026-11-01",
        endDate: "2026-10-15",
        frequency: "monthly",
      }),
    /depois do início/,
  );
});

test("end date must be after the start", () => {
  assert.throws(
    () =>
      buildContributionPlan({
        targetCents: 100,
        contributedCents: 0,
        startDate: "2026-05-01",
        endDate: "2026-05-01",
        frequency: "daily",
      }),
    /depois do início/,
  );
  assert.throws(
    () =>
      buildContributionPlan({
        targetCents: 100,
        contributedCents: 0,
        startDate: "2026-05-02",
        endDate: "2026-05-01",
        frequency: "weekly",
      }),
    /depois do início/,
  );
});

test("reservation calendar stays on one plan month until every month is shown", () => {
  const months = planMonthKeys([
    "2026-12-18",
    "2026-11-18",
    "2027-01-18",
    "2026-11-18",
  ]);
  assert.deepEqual(months, ["2026-11", "2026-12", "2027-01"]);
  assert.equal(
    defaultMonthIndex({
      months,
      today: "2026-10-18",
      upcomingDate: "2026-11-18",
    }),
    0,
  );
  assert.equal(
    defaultMonthIndex({
      months,
      today: "2026-11-02",
      upcomingDate: "2026-12-18",
    }),
    1,
  );
  assert.equal(
    defaultMonthIndex({ months, today: "2026-12-20", upcomingDate: null }),
    1,
  );
  assert.equal(
    defaultMonthIndex({ months, today: "2026-08-01", upcomingDate: null }),
    0,
  );
  assert.equal(stepMonthIndex(0, -1, months.length), 0);
  assert.equal(stepMonthIndex(0, 1, months.length), 1);
  assert.equal(stepMonthIndex(2, 1, months.length), 2);
});

test("calendar marks on-time, late, missed and upcoming dates", () => {
  const statuses = assignContributionStatuses({
    dates: ["2026-01-10", "2026-01-17", "2026-01-24", "2026-01-31"],
    today: "2026-01-20",
    contributions: [
      { paidOn: "2026-01-10", amountCents: 1000 },
      { paidOn: "2026-01-18", amountCents: 1000 },
    ],
  });
  assert.deepEqual(statuses, ["on_time", "late", "upcoming", "upcoming"]);

  assert.deepEqual(
    assignContributionStatuses({
      dates: ["2026-01-10"],
      today: "2026-01-20",
      contributions: [],
    }),
    ["missed"],
  );

  assert.deepEqual(
    assignContributionStatuses({
      dates: ["2026-01-10", "2026-01-17"],
      today: "2026-01-20",
      contributions: [{ paidOn: "2026-01-17", amountCents: 500 }],
    }),
    ["missed", "on_time"],
  );

  assert.deepEqual(
    assignContributionStatuses({
      dates: ["2026-01-20"],
      today: "2026-01-20",
      contributions: [],
    }),
    ["upcoming"],
  );
});

test("a payment one day late marks the due date with an X and the payment date in yellow", () => {
  const slots = resolveContributionSlots({
    dates: ["2026-06-10"],
    today: "2026-06-12",
    contributions: [{ paidOn: "2026-06-11", amountCents: 100 }],
  });
  assert.equal(slots[0].status, "late_payment");
  assert.equal(slots[0].paidOn, "2026-06-11");
  assert.deepEqual(slots[0].missedDays, []);
  const marks = calendarMarks(slots);
  const due = marks.find((day) => day.date === "2026-06-10");
  const paid = marks.find((day) => day.date === "2026-06-11");
  assert.ok(due.marks.includes("due"));
  assert.ok(due.marks.includes("late_due"));
  assert.ok(paid.marks.includes("late_paid"));
  assert.equal(marks.some((day) => day.marks.includes("missed")), false);
});

test("a missed stretch of 3 days stays on the calendar", () => {
  const slots = resolveContributionSlots({
    dates: ["2026-06-10"],
    today: "2026-06-12",
    contributions: [],
  });
  assert.equal(slots[0].status, "missed");
  assert.deepEqual(slots[0].missedDays, ["2026-06-10", "2026-06-11", "2026-06-12"]);
  const missed = calendarMarks(slots)
    .filter((day) => day.marks.includes("missed"))
    .map((day) => day.date);
  assert.deepEqual(missed, ["2026-06-10", "2026-06-11", "2026-06-12"]);
});

test("an on-time payment marks only the due date", () => {
  const slots = resolveContributionSlots({
    dates: ["2026-06-10"],
    today: "2026-06-12",
    contributions: [{ paidOn: "2026-06-10", amountCents: 100 }],
  });
  assert.equal(slots[0].status, "on_time");
  assert.deepEqual(slots[0].missedDays, []);
  const marks = calendarMarks(slots);
  assert.deepEqual(marks.map((day) => day.date), ["2026-06-10"]);
  assert.ok(marks[0].marks.includes("on_time"));
  assert.equal(
    marks.some((day) =>
      day.marks.some((mark) => mark === "missed" || mark === "late_due" || mark === "late_paid"),
    ),
    false,
  );
});

test("days between a late payment stay marked after the money arrives", () => {
  const slots = resolveContributionSlots({
    dates: ["2026-06-10"],
    today: "2026-06-20",
    contributions: [{ paidOn: "2026-06-13", amountCents: 100 }],
  });
  assert.equal(slots[0].status, "late_payment");
  assert.deepEqual(slots[0].missedDays, ["2026-06-11", "2026-06-12"]);
  const missed = calendarMarks(slots)
    .filter((day) => day.marks.includes("missed"))
    .map((day) => day.date);
  assert.deepEqual(missed, ["2026-06-11", "2026-06-12"]);
});

test("goal health follows the next due date and a passed unpaid date", () => {
  assert.equal(
    goalHealth({
      today: "2026-06-10",
      dueDates: ["2026-06-11"],
      contributions: [],
      progressPercent: 10,
    }),
    "near_late",
  );
  assert.equal(
    goalHealth({
      today: "2026-06-12",
      dueDates: ["2026-06-10"],
      contributions: [],
      progressPercent: 10,
    }),
    "late",
  );
  assert.equal(
    goalHealth({
      today: "2026-06-12",
      dueDates: ["2026-06-10", "2026-07-10"],
      contributions: [{ paidOn: "2026-06-10", amountCents: 100 }],
      progressPercent: 20,
    }),
    "on_track",
  );
  assert.equal(
    goalHealth({
      today: "2026-06-12",
      dueDates: ["2026-06-10"],
      contributions: [],
      progressPercent: 100,
    }),
    "complete",
  );
});

test("each aporte is a rope point from the base to the summit", () => {
  assert.equal(ropeMark("upcoming"), "upcoming");
  assert.equal(ropeMark("on_time"), "on_time");
  assert.equal(ropeMark("late_payment"), "late");
  assert.equal(ropeMark("missed"), "late");
  assert.deepEqual(ropePoints(0), []);
  const two = ropePoints(2);
  assert.equal(two.length, 2);
  assert.ok(two[0].y > two[1].y, "the first aporte stays below the last");
  const many = ropePoints(4);
  assert.equal(many.length, 4);
  assert.ok(many[0].y > many[1].y && many[1].y > many[2].y && many[2].y > many[3].y);
  assert.deepEqual(many[0], ropePoints(2)[0]);
  assert.deepEqual(many[many.length - 1], two[two.length - 1]);
  assert.deepEqual(ropePoints(1), [two[1]]);
});

test("on-time climb carries supplies while a late night stays stormy", () => {
  assert.deepEqual(suppliesFor("on_track", 0), ["mochila"]);
  assert.deepEqual(suppliesFor("on_track", 35), ["mochila", "corda"]);
  assert.deepEqual(suppliesFor("on_track", 85), [
    "mochila",
    "corda",
    "casaco",
    "comida",
    "lanterna",
  ]);
  assert.deepEqual(suppliesFor("complete", 100), [
    "mochila",
    "corda",
    "casaco",
    "comida",
    "lanterna",
  ]);
  assert.deepEqual(suppliesFor("near_late", 85), []);
  assert.deepEqual(suppliesFor("late", 85), []);

  assert.equal(dayPhase(10), "day");
  assert.equal(dayPhase(22), "night");
  const day = journeyWeather({ health: "on_track", hour: 15 });
  assert.equal(day.phase, "day");
  assert.equal(day.kind, "clear");
  assert.equal(day.density, 1);
  const night = journeyWeather({ health: "on_track", hour: 23 });
  assert.equal(night.phase, "night");
  assert.equal(night.kind, "calm");
  assert.equal(night.density, 1);

  const near = journeyWeather({ health: "near_late", hour: 15 });
  assert.equal(near.phase, "day");
  assert.equal(near.kind, "rain");
  assert.ok(near.density > day.density);

  const lateNight = journeyWeather({ health: "late", hour: 23, external: "clear" });
  assert.equal(lateNight.phase, "night");
  assert.equal(lateNight.kind, "storm");
  assert.ok(lateNight.density > night.density);
  assert.ok(lateNight.density > near.density);
  assert.equal(climbMotion("on_track"), "confident");
  assert.equal(climbMotion("near_late"), "slow");
  assert.equal(climbMotion("late"), "slip");
  assert.equal(climbMotion("complete"), "celebrate");
  assert.equal(mapOpenWeather({ code: 211, windSpeed: 1 }), "storm");
  assert.equal(mapOpenWeather({ code: 800, windSpeed: 2 }), "clear");
  assert.deepEqual(previewScene("progress_30", { health: "late", progressPercent: 10 }), {
    health: "on_track",
    progressPercent: 30,
  });
  assert.deepEqual(previewScene("progress_100", { health: "on_track", progressPercent: 10 }), {
    health: "complete",
    progressPercent: 100,
  });
  assert.deepEqual(previewScene("live", { health: "near_late", progressPercent: 12 }), {
    health: "near_late",
    progressPercent: 12,
  });
});

test("day-before WhatsApp sends once and names the reservation and the goal", () => {
  const first = contributionReminder({
    today: "2026-06-09",
    dueDate: "2026-06-10",
    reservationName: "iPhone 17",
    goalName: "Fim de ano",
    paidOn: null,
    sent: { dayBefore: false, late: false },
  });
  assert.equal(first.send, true);
  assert.equal(first.kind, "day_before");
  assert.match(first.body, /iPhone 17/);
  assert.match(first.body, /Fim de ano/);
  assert.match(first.body, /aporte/i);
  const again = contributionReminder({
    today: "2026-06-09",
    dueDate: "2026-06-10",
    reservationName: "iPhone 17",
    goalName: "Fim de ano",
    paidOn: null,
    sent: { dayBefore: true, late: false },
  });
  assert.equal(again.send, false);
});

test("a due date with no payment sends the late WhatsApp notice", () => {
  const decision = contributionReminder({
    today: "2026-06-10",
    dueDate: "2026-06-10",
    reservationName: "iPhone 17",
    goalName: "Fim de ano",
    paidOn: null,
    sent: { dayBefore: true, late: false },
  });
  assert.equal(decision.send, true);
  assert.equal(decision.kind, "late");
  assert.match(decision.body, /atrasada/);
  assert.match(decision.body, /iPhone 17/);
  assert.match(decision.body, /Fim de ano/);
});

test("an on-time payment sends neither the late notice", () => {
  const onDue = contributionReminder({
    today: "2026-06-10",
    dueDate: "2026-06-10",
    reservationName: "iPhone 17",
    goalName: "Fim de ano",
    paidOn: "2026-06-10",
    sent: { dayBefore: false, late: false },
  });
  assert.equal(onDue.send, false);
  const dayBefore = contributionReminder({
    today: "2026-06-09",
    dueDate: "2026-06-10",
    reservationName: "iPhone 17",
    goalName: "Fim de ano",
    paidOn: "2026-06-09",
    sent: { dayBefore: false, late: false },
  });
  assert.equal(dayBefore.send, false);
});

test("a late notice already sent is not sent again", () => {
  const decision = contributionReminder({
    today: "2026-06-11",
    dueDate: "2026-06-10",
    reservationName: "iPhone 17",
    goalName: "Fim de ano",
    paidOn: null,
    sent: { dayBefore: true, late: true },
  });
  assert.equal(decision.send, false);
});

test("the client dock includes Metas", () => {
  assert.ok(
    CLIENTE_DOCK.some((item) => item.href === "/app/metas" && item.label === "Metas"),
  );
});

test("climb status is late when a deposit is overdue and near late the day before", () => {
  const pending = (dueDate) => ({ id: dueDate, dueDate, amount: 10, status: "pending" });
  assert.equal(
    deriveStatus([pending("2026-06-10")], 10, "2026-06-12"),
    "late",
  );
  assert.equal(
    deriveStatus(
      [{ id: "m", dueDate: "2026-06-01", amount: 10, status: "missed" }, pending("2026-07-01")],
      20,
      "2026-06-12",
    ),
    "late",
  );
  assert.equal(deriveStatus([pending("2026-06-10")], 40, "2026-06-10"), "near_late");
  assert.equal(deriveStatus([pending("2026-06-11")], 40, "2026-06-10"), "near_late");
  assert.equal(deriveStatus([pending("2026-06-12")], 40, "2026-06-10"), "on_track");
  assert.equal(
    deriveStatus(
      [{ id: "late-paid", dueDate: "2026-06-01", amount: 10, status: "paid_late" }, pending("2026-06-20")],
      30,
      "2026-06-03",
    ),
    "on_track",
  );
  assert.equal(deriveStatus([pending("2026-06-01")], 100, "2026-06-20"), "done");
  assert.equal(relativeDue("2026-06-10", "2026-06-10"), "hoje");
  assert.equal(relativeDue("2026-06-11", "2026-06-10"), "amanhã");
  assert.equal(relativeDue("2026-06-09", "2026-06-10"), "atrasado há 1 dia");
  assert.match(brl(10.5).replace(/\s/g, " "), /R\$ 10,50/);
  assert.match(brl(100).replace(/\s/g, " "), /R\$ 100(?!,)/);
});

test("the climb adapter maps the real schedule without treating a paid-late aporte as missed", () => {
  const plan = buildContributionPlan({
    targetCents: 30000,
    contributedCents: 0,
    startDate: "2026-06-01",
    endDate: "2026-06-15",
    frequency: "weekly",
  });
  assert.deepEqual(plan.dates, ["2026-06-01", "2026-06-08", "2026-06-15"]);

  const onTime = climbGoalFromPlan({
    id: "meta-1",
    name: "Meu iPhone",
    productName: "iPhone 16 Pro",
    targetCents: 30000,
    savedCents: 10000,
    today: "2026-06-02",
    plan,
    contributions: [{ paidOn: "2026-06-01", amountCents: 10000 }],
  });
  assert.equal(onTime.status, "on_track");
  assert.equal(onTime.product.kind, "phone");
  assert.equal(onTime.percent, 33);
  assert.equal(onTime.deposits[0].status, "paid_on_time");
  assert.equal(onTime.deposits[1].status, "pending");
  assert.equal(onTime.streak, 1);
  assert.equal(onTime.daysLate, 0);
  assert.equal(onTime.deposits[0].amount, 100);

  const almost = climbGoalFromPlan({
    id: "meta-1",
    name: "Meu iPhone",
    productName: "iPhone 16 Pro",
    targetCents: 30000,
    savedCents: 10000,
    today: "2026-06-07",
    plan,
    contributions: [{ paidOn: "2026-06-01", amountCents: 10000 }],
  });
  assert.equal(almost.status, "near_late");
  assert.equal(almost.deposits[1].dueDate, "2026-06-08");

  const paidLate = climbGoalFromPlan({
    id: "meta-1",
    name: "Meu iPhone",
    productName: "iPhone 16 Pro",
    targetCents: 30000,
    savedCents: 10000,
    today: "2026-06-03",
    plan,
    contributions: [{ paidOn: "2026-06-03", amountCents: 10000 }],
  });
  assert.equal(paidLate.deposits[0].status, "paid_late");
  assert.equal(paidLate.deposits[0].paidAt, "2026-06-03");
  assert.equal(paidLate.status, "on_track");
  assert.equal(paidLate.streak, 0);

  const overdue = climbGoalFromPlan({
    id: "meta-1",
    name: "Meu iPhone",
    productName: "iPhone 16 Pro",
    targetCents: 30000,
    savedCents: 0,
    today: "2026-06-09",
    plan,
    contributions: [],
  });
  assert.equal(overdue.status, "late");
  assert.equal(overdue.deposits[0].status, "missed");
  assert.equal(overdue.deposits[1].status, "missed");
  assert.equal(overdue.deposits[2].status, "pending");
  assert.equal(overdue.daysLate, 8);
  assert.equal(
    climbDaysLate("2026-06-09", [
      { status: "missed", dueDate: "2026-06-01" },
      { status: "pending", dueDate: "2026-06-15" },
    ]),
    8,
  );
  assert.equal(
    climbStreak([
      { status: "paid_on_time" },
      { status: "paid_on_time" },
      { status: "paid_late" },
      { status: "paid_on_time" },
    ]),
    1,
  );

  const conquered = climbGoalFromPlan({
    id: "meta-1",
    name: "Meu iPhone",
    productName: "iPhone 16 Pro",
    targetCents: 30000,
    savedCents: 30000,
    today: "2026-06-20",
    plan,
    contributions: [
      { paidOn: "2026-06-01", amountCents: 10000 },
      { paidOn: "2026-06-08", amountCents: 10000 },
      { paidOn: "2026-06-15", amountCents: 10000 },
    ],
  });
  assert.equal(conquered.status, "done");
  assert.equal(conquered.percent, 100);
  assert.ok(conquered.deposits.every((deposit) => deposit.status === "paid_on_time"));
  assert.equal(conquered.streak, 3);

  assert.equal(prizeKindFromProductName("MacBook Air"), "laptop");
  assert.equal(prizeKindFromProductName("AirPods Pro"), "headphones");
  assert.equal(prizeKindFromProductName("Apple Watch"), "gift");
});

console.log(`\n${passed} test(s) passed.`);
