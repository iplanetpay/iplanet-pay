import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  applyEarlyPayments,
  buildContributionPlan,
  nextOpenAporteCents,
} from "../../src/lib/reservations/contribution-plan.ts";
import { TERMS_OF_USE_PT, TERMS_VERSION } from "../../src/lib/withdrawals/types.ts";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const plan = (o) => buildContributionPlan({ contributedCents: 0, ...o });

export default function suite(test) {
  test("simulator plan: 7999,00 in 3 monthly aportes leaves the cents on the last one", () => {
    const p = plan({ targetCents: 799900, startDate: "2026-10-21", endDate: "2027-01-05", frequency: "monthly" });
    assert.deepEqual(p.dates, ["2026-10-21", "2026-11-21", "2026-12-21"]);
    assert.equal(p.amountPerInstallmentCents, 266633);
    assert.equal(p.lastInstallmentCents, 266634);
  });

  test("simulator plan: monthly on the 31st clamps to month end and returns to the 31st", () => {
    assert.deepEqual(
      plan({ targetCents: 100000, startDate: "2028-01-31", endDate: "2028-05-31", frequency: "monthly" }).dates,
      ["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30", "2028-05-31"],
    );
    assert.deepEqual(
      plan({ targetCents: 300, startDate: "2026-12-30", endDate: "2027-03-30", frequency: "monthly" }).dates,
      ["2026-12-30", "2027-01-30", "2027-02-28", "2027-03-30"],
    );
  });

  test("simulator plan: weekly and daily stop at the last date that fits", () => {
    assert.deepEqual(
      plan({ targetCents: 799900, startDate: "2026-10-21", endDate: "2026-11-20", frequency: "weekly" }).dates,
      ["2026-10-21", "2026-10-28", "2026-11-04", "2026-11-11", "2026-11-18"],
    );
    const d = plan({ targetCents: 1000, startDate: "2026-10-21", endDate: "2026-10-23", frequency: "daily" });
    assert.deepEqual([d.installmentCount, d.amountPerInstallmentCents, d.lastInstallmentCents], [3, 333, 334]);
    assert.throws(() => plan({ targetCents: 1000, startDate: "2026-10-21", endDate: "2026-10-21", frequency: "daily" }));
  });

  test("simulator plan from a reservation covers only what is left", () => {
    const p = buildContributionPlan({ targetCents: 799900, contributedCents: 200000, startDate: "2026-10-21", endDate: "2027-03-21", frequency: "monthly" });
    assert.equal(p.remainingCents, 599900);
    assert.equal(p.installmentCount, 6);
    assert.equal(p.amountPerInstallmentCents * 5 + p.lastInstallmentCents, 599900);
  });

  test("an early payment cascades into the next aportes without moving dates", () => {
    const rows = applyEarlyPayments({
      installments: [
        { dueDate: "2026-11-21", amountCents: 266633 },
        { dueDate: "2026-12-21", amountCents: 266633 },
        { dueDate: "2027-01-21", amountCents: 266634 },
      ],
      contributions: [
        { paidOn: "2026-11-10", amountCents: 400000 },
        { paidOn: "2026-12-01", amountCents: 200000 },
      ],
    });
    assert.deepEqual(rows.map((r) => [r.dueDate, r.dueCents, r.paid, r.antecipado]), [
      ["2026-11-21", 0, true, true],
      ["2026-12-21", 0, true, true],
      ["2027-01-21", 199900, false, true],
    ]);
    assert.equal(nextOpenAporteCents(rows), 199900);
  });

  test("Pix no longer asks for a contract per aporte; the old field is tolerated", () => {
    const gen = source("src/lib/pix/generate.ts");
    assert.equal(/Aceite o contrato do aporte/.test(gen), false);
    assert.equal(gen.includes("assertAporteContract"), false);
    assert.match(gen, /if \(contractId\)\s*await linkAporteContract/);
    assert.equal(existsSync(new URL("../../src/components/pix/aporte-contract-modal.tsx", import.meta.url)), false);
    assert.equal(/contract/i.test(source("src/components/pix/gerar-pix-form.tsx")), false);
    assert.match(source("src/app/api/pix/generate/route.ts"), /contract_id/);
  });

  test("the aporte contract lives in the Termos de Uso accepted at signup", () => {
    assert.equal(TERMS_VERSION, "platform-v3");
    assert.match(TERMS_OF_USE_PT, /7\. Contrato de aporte/);
    assert.match(TERMS_OF_USE_PT, /não é preciso aceitá-lo de novo a cada Pix/);
    assert.match(source("src/app/termos/page.tsx"), /id="contrato-de-aporte"/);
    assert.match(source("src/components/auth/signup-form.tsx"), /terms_version: TERMS_VERSION/);
  });

  test("skeletons only pulse in place and are static with reduced motion", () => {
    const css = source("src/app/globals.css");
    assert.equal(/experience-shimmer|translateX\(-100%\)/.test(css), false);
    assert.match(css, /@keyframes skeleton-pulse \{\s*0%,\s*100% \{\s*opacity: 1;\s*\}\s*50% \{\s*opacity: 0\.55;\s*\}\s*\}/);
    assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.experience-skeleton,\s*\.route-skeleton \{\s*animation: none;/);
    assert.match(source("src/app/loading.tsx"), /return null/, "no landing skeleton on the way into the app");
    for (const f of ["src/app/app/loading.tsx", "src/app/admin/loading.tsx", "src/app/app/reserva/[id]/loading.tsx"]) {
      assert.match(source(f), /return null/, f);
    }
    const loader = source("src/components/navigation/route-experience-loader.tsx");
    assert.match(loader, /route-skeleton/);
    assert.equal(loader.includes("ExperiencePreloaderOverlay"), false, "no generic full-screen skeleton over the real layout");
    assert.equal(/[{,]\s*y:/.test(source("src/components/ui/motion.tsx").split("export function RouteTransition")[1].split("export function")[0]), false);
  });
}
