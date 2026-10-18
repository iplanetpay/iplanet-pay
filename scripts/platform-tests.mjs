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

console.log(`\n${passed} test(s) passed.`);
