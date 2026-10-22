import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cancelShouldSubmit, nextCancelStep } from "../../src/lib/reservations/cancel-confirm.ts";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function run(actions) {
  let step = "idle";
  let calls = 0;
  for (const a of actions) {
    if (cancelShouldSubmit(step, a)) calls++;
    step = nextCancelStep(step, a);
  }
  return { step, calls };
}

export default function suite(test) {
  test("Cancelar reserva: só chama a API após as duas confirmações", () => {
    assert.equal(run(["open"]).calls, 0);
    assert.equal(run(["open", "confirm"]).calls, 0); // pular a 1ª etapa não dispara
    assert.equal(run(["open", "continue"]).calls, 0);
    assert.deepEqual(run(["open", "continue", "confirm"]), { step: "submitting", calls: 1 });
    assert.equal(run(["confirm"]).calls, 0);
    assert.equal(run(["continue", "confirm"]).calls, 0);
  });

  test("Cancelar reserva: botões de cancelar fecham sem ação e não há duplo envio", () => {
    assert.deepEqual(run(["open", "dismiss"]), { step: "idle", calls: 0 });
    assert.deepEqual(run(["open", "continue", "dismiss", "confirm"]), { step: "idle", calls: 0 });
    assert.deepEqual(run(["open", "continue", "confirm", "confirm", "dismiss"]), { step: "submitting", calls: 1 });
    assert.deepEqual(run(["open", "continue", "confirm", "failed"]), { step: "idle", calls: 1 });
  });

  test("Cancelar reserva (site): usa a dupla confirmação, sem window.confirm", () => {
    const btn = source("src/components/reservations/cancel-button.tsx");
    assert.doesNotMatch(btn, /window\.confirm/);
    assert.match(btn, /cancelShouldSubmit\(step, "confirm"\)/);
    assert.ok(btn.indexOf("cancelShouldSubmit") < btn.indexOf('fetch("/api/reservations/cancel"'));
  });

  test("Cancelar reserva (app): botão abre a confirmação em vez de chamar a API", () => {
    const ios = source("ios/iPlanetPay/Features/Reservations/ReservationDetailView.swift");
    assert.doesNotMatch(ios, /Button\("Cancelar reserva", role: \.destructive\) \{\s*Task \{ await cancel\(\) \}/);
    assert.match(ios, /CancelConfirm\.next/);
    assert.match(ios, /CancelConfirm\.shouldSubmit/);
  });
}
