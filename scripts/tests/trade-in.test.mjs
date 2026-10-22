import assert from "node:assert/strict";
import {
  MAX_TRADE_IN_DEVICES,
  batteryHealthLabel,
  parseBatteryHealth,
  validateTradeInDevice,
  validateTradeInDevices,
} from "../../src/lib/trade-in/devices.ts";
import {
  isLiveOffer,
  needsExpirySync,
  tradeInCashCents,
  tradeInCreditSummary,
} from "../../src/lib/trade-in/offer-state.ts";

const REVIEWED = "2026-10-01T00:00:00.000Z";
const NOW = new Date("2026-10-19T00:00:00.000Z").getTime();

function offer(overrides) {
  return {
    id: "o",
    user_id: "u",
    reservation_id: "r",
    device_model: "iPhone 13",
    imei: "1",
    expected_value_cents: 100_000,
    minimum_value_cents: 100_000,
    maintenance_options: ["nunca_aberto"],
    liquid_exposure: false,
    photo_paths: [],
    battery_health_pct: 90,
    battery_health_reason: null,
    status: "pending",
    admin_message: null,
    approved_value_cents: null,
    reviewed_at: null,
    created_at: REVIEWED,
    ...overrides,
  };
}

function approved(id, cents, overrides = {}) {
  return offer({ id, status: "approved", approved_value_cents: cents, reviewed_at: REVIEWED, ...overrides });
}

function deviceInput(overrides = {}) {
  return {
    deviceModel: "iPhone 13",
    imei: "356789012345678",
    expectedBrl: "1500",
    minimumBrl: "1200",
    maintenanceOptions: ["nunca_aberto"],
    liquidExposure: false,
    batteryHealthPct: "87",
    batteryHealthReason: null,
    photoCount: 2,
    ...overrides,
  };
}

export default function suite(test) {
  test("trade-in credit is the sum of every accepted device", () => {
    const offers = [approved("a", 150_000), approved("b", 80_000), approved("c", 20_000)];
    const summary = tradeInCreditSummary(offers, NOW);
    assert.equal(summary.activeCents, 250_000);
    assert.equal(summary.acceptedCount, 3);
    assert.equal(summary.inPaidCents, 250_000);
    assert.equal(tradeInCashCents(300_000, offers, NOW), 50_000);
  });

  test("rejected, pending, counter-offer and discarded devices add no credit", () => {
    const offers = [
      approved("a", 150_000),
      offer({ id: "b", status: "rejected", admin_message: "Tela trincada" }),
      offer({ id: "c", status: "pending" }),
      offer({ id: "d", status: "pending", reviewed_at: REVIEWED, approved_value_cents: 70_000 }),
      approved("e", 40_000, { admin_message: "DESCARTADA|" }),
    ];
    const summary = tradeInCreditSummary(offers, NOW);
    assert.equal(summary.activeCents, 150_000);
    assert.equal(summary.acceptedCount, 1);
    assert.equal(summary.inPaidCents, 150_000);
    assert.equal(isLiveOffer(offers[1]), false);
    assert.equal(isLiveOffer(offers[2]), true);
    assert.equal(isLiveOffer(offers[4]), false);
  });

  test("each device keeps its own 90-day cycle inside the sum", () => {
    const old = approved("old", 60_000, { reviewed_at: "2026-06-01T00:00:00.000Z" });
    const fresh = approved("fresh", 90_000);
    const summary = tradeInCreditSummary([old, fresh], NOW);
    assert.equal(summary.activeCents, 90_000);
    assert.equal(summary.expiredCents, 60_000);
    assert.equal(summary.inPaidCents, 150_000);
    assert.equal(needsExpirySync(old, NOW), true);
    assert.equal(needsExpirySync(fresh, NOW), false);

    const marked = { ...old, admin_message: "EXPIRADA|" };
    const after = tradeInCreditSummary([marked, fresh], NOW);
    assert.equal(after.expiredCents, 60_000);
    assert.equal(after.inPaidCents, 90_000);
    assert.equal(needsExpirySync(marked, NOW), false);
  });

  test("battery health is required and must be an integer from 0 to 100", () => {
    assert.equal(parseBatteryHealth("", null).ok, false);
    assert.equal(parseBatteryHealth(undefined, undefined).ok, false);
    assert.match(parseBatteryHealth("  ", "").error, /Informe o estado da bateria/);
    assert.equal(parseBatteryHealth("101", null).ok, false);
    assert.equal(parseBatteryHealth("-1", null).ok, false);
    assert.equal(parseBatteryHealth("87.5", null).ok, false);
    assert.equal(parseBatteryHealth("abc", null).ok, false);
    assert.deepEqual(parseBatteryHealth("0", null), { ok: true, value: { pct: 0, reason: null } });
    assert.deepEqual(parseBatteryHealth("100", null), { ok: true, value: { pct: 100, reason: null } });
    assert.deepEqual(parseBatteryHealth("87%", null), { ok: true, value: { pct: 87, reason: null } });
    assert.deepEqual(parseBatteryHealth(87, null), { ok: true, value: { pct: 87, reason: null } });
  });

  test("devices without a battery reading must answer Não sei or Não se aplica", () => {
    assert.deepEqual(parseBatteryHealth("", "not_applicable"), {
      ok: true,
      value: { pct: null, reason: "not_applicable" },
    });
    assert.deepEqual(parseBatteryHealth("", "unknown"), {
      ok: true,
      value: { pct: null, reason: "unknown" },
    });
    assert.equal(parseBatteryHealth("", "maybe").ok, false);
    assert.equal(parseBatteryHealth("80", "unknown").ok, false);
    assert.equal(batteryHealthLabel({ battery_health_pct: 87, battery_health_reason: null }), "87%");
    assert.equal(batteryHealthLabel({ battery_health_pct: null, battery_health_reason: "unknown" }), "Não sei");
    assert.equal(
      batteryHealthLabel({ battery_health_pct: null, battery_health_reason: "not_applicable" }),
      "Não se aplica",
    );
    assert.equal(batteryHealthLabel({ battery_health_pct: null, battery_health_reason: null }), "Não informado");
  });

  test("a device without battery health is rejected before it reaches the database", () => {
    const missing = validateTradeInDevice(deviceInput({ batteryHealthPct: "" }));
    assert.equal(missing.ok, false);
    assert.match(missing.error, /bateria/);
    const outOfRange = validateTradeInDevice(deviceInput({ batteryHealthPct: "150" }));
    assert.equal(outOfRange.ok, false);
    const ok = validateTradeInDevice(deviceInput({ imei: "35 6789 0123" }));
    assert.equal(ok.ok, true);
    assert.equal(ok.device.imei, "3567890123");
    assert.equal(ok.device.expectedCents, 150_000);
    assert.deepEqual(ok.device.battery, { pct: 87, reason: null });
  });

  test("several devices can be sent together and errors name the device", () => {
    const two = validateTradeInDevices([
      deviceInput(),
      deviceInput({ imei: "111", batteryHealthPct: "", batteryHealthReason: "not_applicable" }),
    ]);
    assert.equal(two.ok, true);
    assert.equal(two.devices.length, 2);

    const second = validateTradeInDevices([deviceInput(), deviceInput({ imei: "111", batteryHealthPct: "" })]);
    assert.equal(second.ok, false);
    assert.match(second.error, /^Aparelho 2: .*bateria/);

    const duplicate = validateTradeInDevices([deviceInput(), deviceInput()]);
    assert.equal(duplicate.ok, false);
    assert.match(duplicate.error, /IMEI/);

    const alreadyLive = validateTradeInDevices([deviceInput()], {
      liveCount: 1,
      liveImeis: ["356789012345678"],
    });
    assert.equal(alreadyLive.ok, false);

    assert.equal(validateTradeInDevices([]).ok, false);
    const tooMany = validateTradeInDevices([deviceInput()], {
      liveCount: MAX_TRADE_IN_DEVICES,
      liveImeis: [],
    });
    assert.equal(tooMany.ok, false);
    assert.match(tooMany.error, /Limite/);
  });
}

// Anel da reserva: azul = aportes em dinheiro, amarelo = usado avaliado (igual ao iOS TradeInCredit.segments).
{
  const { tradeInProgressSegments, TRADE_IN_YELLOW } = await import("../../src/lib/trade-in/offer-state.ts");
  assert.equal(TRADE_IN_YELLOW, "#e0a100");
  assert.deepEqual(tradeInProgressSegments(1_000_000, 300_000, 200_000), { cashPct: 30, tradePct: 20 });
  assert.deepEqual(tradeInProgressSegments(1_000_000, 900_000, 300_000), { cashPct: 90, tradePct: 10 });
  assert.deepEqual(tradeInProgressSegments(0, 1, 1), { cashPct: 0, tradePct: 0 });
}
