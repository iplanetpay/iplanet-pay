import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideSimulation, paymentSimulationEnabled } from "../../src/lib/pix/simulation-guard.ts";

const source = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

export default function suite(test) {
  test("payment simulation: off unless ALLOW_PAYMENT_SIMULATION=true (or mock)", () => {
    assert.equal(paymentSimulationEnabled({}), false);
    assert.equal(paymentSimulationEnabled({ ALLOW_PAYMENT_SIMULATION: "false" }), false);
    assert.equal(paymentSimulationEnabled({ ALLOW_PAYMENT_SIMULATION: "1" }), false);
    assert.equal(paymentSimulationEnabled({ ALLOW_PAYMENT_SIMULATION: "true" }), true);
    assert.equal(paymentSimulationEnabled({ USE_MOCK_AUTH: "true" }), true);
  });

  test("payment simulation: 404 when the flag is off, even for the owner", () => {
    const d = decideSimulation({ enabled: false, userId: "u1", ownerId: "u1" });
    assert.deepEqual([d.allow, d.status], [false, 404]);
    const sim = source("src/lib/pix/simulate.ts");
    // a flag é checada antes de qualquer leitura de sessão ou banco
    assert.ok(sim.indexOf("if (!enabled) return { ok: false, status: 404") < sim.indexOf("getCurrentUser()"));
    assert.match(source("src/app/api/dev/simulate-payment/route.ts"), /status: result\.status/);
    assert.match(source("src/app/api/pix/simulate/route.ts"), /simulatePixPayment/);
  });

  test("payment simulation: 401 without session, 403 for a non-owner, owner allowed", () => {
    assert.equal(decideSimulation({ enabled: true, userId: null, ownerId: "u1" }).status, 401);
    assert.equal(decideSimulation({ enabled: true, userId: "u2", ownerId: "u1" }).status, 403);
    assert.equal(decideSimulation({ enabled: true, userId: "u2", ownerId: null }).status, 403);
    assert.deepEqual(decideSimulation({ enabled: true, userId: "u1", ownerId: "u1" }), { allow: true });
  });

  test("payment simulation confirms through the same code path as the Mercado Pago webhook", () => {
    const webhook = source("src/lib/pix/webhook.ts");
    const sim = source("src/lib/pix/simulate.ts");
    assert.match(webhook, /confirmContributionAsWebhook\(supabase, contributionId\)/);
    assert.match(sim, /confirmContributionAsWebhook\(admin, row\.id\)/);
    // nenhum dos dois chama confirm_contribution por fora do caminho comum
    assert.equal(webhook.includes('"confirm_contribution"'), false);
    assert.equal(sim.includes('"confirm_contribution"'), false);
    const confirm = source("src/lib/pix/confirm.ts");
    for (const step of ['"confirm_contribution"', "notifyAporteConfirmado", "notifyFirstAporteWhatsapp", "maybeNotifyAdminContributionMilestones"]) {
      assert.ok(confirm.includes(step), step);
    }
  });

  test("payment simulation marks the aporte and logs each attempt (migration 038)", () => {
    const sql = source("supabase/migrations/038_payment_simulation.sql");
    assert.match(sql, /add column if not exists simulated_at timestamptz/);
    assert.match(sql, /create table if not exists public\.payment_simulation_log/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke insert, update, delete on table public\.payment_simulation_log from authenticated/);
    const sim = source("src/lib/pix/simulate.ts");
    assert.match(sim, /simulated_at: new Date\(\)\.toISOString\(\), simulated_by: user\.id/);
    assert.match(sim, /from\("payment_simulation_log"\)/);
    assert.match(sim, /\[payment-simulation\]/);
  });

  test("app contract: contribution_id body, Bearer auth, status endpoint", () => {
    assert.match(source("src/app/api/dev/simulate-payment/route.ts"), /pixId: body\.contribution_id \?\? body\.pixId/);
    assert.match(source("src/app/api/dev/simulate-payment/status/route.ts"), /enabled: paymentSimulationEnabled\(\)/);
    assert.match(source("docs/api-contract.md"), /`POST \/api\/dev\/simulate-payment`[^\n]*somente teste/);
  });

  test("site Pix screen shows 'Pago (teste)' only when the server flag is on", () => {
    const form = source("src/components/pix/gerar-pix-form.tsx");
    assert.match(form, /\{simulationEnabled \? \(\s*<Button/);
    assert.match(form, /Pago \(teste\)/);
    assert.equal(form.includes("Avançar"), false);
    assert.match(source("src/app/app/reserva/[id]/page.tsx"), /simulationEnabled=\{paymentSimulationEnabled\(\)\}/);
  });

  test("one-tap 'Pago (teste)': web and iOS advance with a single tap, no dialogs, one working button", () => {
    const form = source("src/components/pix/gerar-pix-form.tsx");
    assert.match(form, /fetch\("\/api\/dev\/simulate-payment"/);
    assert.match(form, /contribution_id: payment\.contributionId/);
    assert.equal(/\bconfirm\(|window\.confirm|alert\(/.test(form), false, "sem diálogo de confirmação");
    assert.equal(form.includes("/api/pix/simulate\""), false, "UI não chama a rota antiga");
    assert.equal(/Avançar/.test(form), false, "sem botão Avançar duplicado");
    assert.match(form, /setConfirmed\(true\)[\s\S]*router\.refresh\(\)/);
    const detail = source("ios/iPlanetPay/Features/Reservations/ReservationDetailView.swift");
    assert.match(detail, /Task \{ await simulatedPaid\(\) \}/);
    assert.match(detail, /private func simulatedPaid\(\) async \{[\s\S]*?onDone\(\)/);
    assert.equal(/confirmationDialog|\.alert\(/.test(detail.slice(detail.indexOf("struct SimulatePaidButton"))), false);
    const api = source("ios/iPlanetPay/Services/WebAPI.swift");
    assert.match(api, /PixConfirmation\.simulationDisabled\(httpStatus: status\)/);
    assert.equal(api.includes("status == 403 || status == 404"), false, "403 não pode esconder o botão");
  });
}
