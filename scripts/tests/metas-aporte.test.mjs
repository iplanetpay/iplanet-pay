import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  goalAporteCents,
  goalDepositHref,
  initialAporteBrl,
  parseAporteParam,
} from "../../src/lib/goals/aporte-prefill.ts";
import { buildGoalSchedule } from "../../src/lib/goals/goal-calendar.ts";

const source = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

export default function suite(test) {
  test("metas: 'Fazer aporte' pre-fills the goal installment (editable, capped)", () => {
    assert.equal(goalDepositHref("r1", 70384), "/app/reserva/r1?aporte=70384");
    assert.equal(goalDepositHref("r1", 0), "/app/reserva/r1");
    assert.equal(parseAporteParam("70384"), 70384);
    assert.equal(parseAporteParam("abc"), 0);
    assert.equal(parseAporteParam(undefined), 0);
    assert.equal(initialAporteBrl(70384, 915000), "703.84");
    assert.equal(initialAporteBrl(70384, 20000), "200.00");
    assert.equal(initialAporteBrl(0, 915000), "50.00");
    assert.equal(goalAporteCents({ installmentCents: 100, remainingCents: 9000 }), 500);
    assert.match(source("src/lib/goals/climb/load-entries.ts"), /goalDepositHref\(reservationId, goal\.installment_cents\)/);
    assert.match(source("src/app/app/reserva/[id]/page.tsx"), /prefillCents=\{aportePrefillCents\}/);
    assert.match(source("src/components/pix/gerar-pix-form.tsx"), /initialAporteBrl\(prefillCents, remainingCents\)/);
  });

  test("metas: aportes confirmed on the goal's start day count (Richard 22/10 case)", () => {
    const s = buildGoalSchedule({
      name: "iPhone 18 Pro Max",
      amountCents: 915000,
      startDate: "2026-10-22",
      targetDate: "2027-10-22",
      frequency: "monthly",
      contributions: [
        { paidOn: "2026-10-22", amountCents: 70384 },
        { paidOn: "2026-10-22", amountCents: 100000 },
      ],
      today: "2026-10-22",
    });
    assert.equal(s.savedCents, 170384);
    assert.equal(s.progressPercent, 19);
  });

  test("metas: confirmed aporte reaches Metas immediately (web cache + iOS reload)", () => {
    const confirm = source("src/lib/pix/confirm.ts");
    assert.match(confirm, /revalidateAporteViews\(\)/);
    assert.match(confirm, /"\/app\/metas"/);
    const screen = source("src/components/goals/climb/metas-screen.tsx");
    assert.match(screen, /router\.refresh\(\)/);
    assert.match(screen, /visibilitychange/);
    const goals = source("ios/iPlanetPay/Features/Goals/GoalsView.swift");
    assert.match(goals, /onChange\(of: router\.contributionsVersion\)/);
    assert.match(goals, /if tab == \.goals/);
    assert.match(goals, /requestPixAmountCents = GoalAporte\.prefillCents/);
    const detail = source("ios/iPlanetPay/Features/Reservations/ReservationDetailView.swift");
    assert.equal((detail.match(/router\.contributionsVersion \+= 1/g) ?? []).length, 3);
    assert.match(detail, /AporteSheet\(reservation: reservation, prefillCents: aportePrefillCents\)/);
    const exp = source("ios/iPlanetPay/Features/Goals/GoalExperience.swift");
    assert.match(exp, /GoalAporte\.contributions\(contributions, reservationId: goal\.reservationId\)/);
  });
}
