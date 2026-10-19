import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAT_GRID_4, statValueFontSize } from "../../src/lib/admin/stat-value.ts";
import {
  clientActivityHref,
  clientTotals,
  formatDateBR,
  mergeReferredClients,
  tradeInTone,
  withdrawalTone,
} from "../../src/lib/clients/activity.ts";

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

function parseClamp(size) {
  const match = size.match(/^clamp\(([\d.]+)rem, ([\d.]+)cqi, ([\d.]+)rem\)$/);
  assert.ok(match, `unexpected font size ${size}`);
  return { min: Number(match[1]), cqi: Number(match[2]), max: Number(match[3]) };
}

export default function suite(test) {
  test("admin stat values shrink with the card so R$ 157.574,00 is not clipped", () => {
    const money = "R$\u00a0157.574,00";
    const long = parseClamp(statValueFontSize(money));
    const chars = [...money].length;
    assert.ok(chars * 0.55 * long.cqi <= 100, "the value must fit 100% of the card width");
    assert.ok(long.max <= 2.25);
    const short = parseClamp(statValueFontSize("2"));
    assert.ok(short.cqi > long.cqi, "short counts stay larger than long money values");
    assert.equal(short.max, 2.25);
    assert.equal(parseClamp(statValueFontSize("R$ 18.598,00", 1.875)).max, 1.875);
  });

  test("admin stat grids wrap to fewer columns before four cards get narrow", () => {
    assert.match(STAT_GRID_4, /grid-cols-1/);
    assert.match(STAT_GRID_4, /xl:grid-cols-4/);
    assert.equal(STAT_GRID_4.includes("md:grid-cols-4"), false);
    const card = source("src/components/ui/stat-card.tsx");
    assert.match(card, /@container/);
    assert.match(card, /min-w-0/);
    assert.match(card, /overflow-wrap:anywhere/);
    for (const file of [
      "src/app/admin/page.tsx",
      "src/app/admin/financeiro/page.tsx",
      "src/components/reservations/ops-reservas-panel.tsx",
      "src/components/analytics/dashboards-panel.tsx",
    ]) {
      const text = source(file);
      assert.match(text, /<StatCard/, `${file} uses StatCard`);
      assert.equal(/md:text-4xl|text-4xl font-bold tracking-tight">\{value\}/.test(text), false, file);
    }
    assert.equal(source("src/app/admin/page.tsx").includes("grid gap-4 md:grid-cols-4"), false);
  });

  test("the client screen no longer shows the Crédito and Trocar buttons", () => {
    for (const file of [
      "src/components/clients/client-detail-view.tsx",
      "src/components/clients/clientes-panel.tsx",
    ]) {
      const text = source(file);
      assert.equal(text.includes("Crédito"), false, file);
      assert.equal(text.includes("Trocar"), false, file);
      assert.equal(text.includes("RefreshCw"), false, file);
    }
  });

  test("Admin > Reservas opens the same client screen used by Admin > Clientes", () => {
    const panel = source("src/components/clients/clientes-panel.tsx");
    const reservas = source("src/components/reservations/ops-reservas-panel.tsx");
    const page = source("src/app/admin/reservas/page.tsx");
    assert.match(panel, /<ClientDetailView/);
    assert.match(reservas, /<ClientDetailView/);
    assert.match(reservas, /<MotionModal/);
    assert.match(page, /clientDetailArea="admin"/);
  });

  test("trade-in and withdrawal rows deep link for admin and stay plain for staff", () => {
    assert.equal(clientActivityHref("admin", "trade_in", "o 1"), "/admin/avaliacao-usados?id=o%201");
    assert.equal(
      clientActivityHref("admin", "withdrawal", "w1"),
      "/admin/financeiro?saque=w1#saque-w1",
    );
    assert.equal(clientActivityHref("staff", "trade_in", "o1"), null);
    assert.equal(clientActivityHref("staff", "withdrawal", "w1"), null);
    assert.match(source("src/app/admin/avaliacao-usados/page.tsx"), /initialOfferId=\{sp\.id/);
    assert.match(source("src/app/admin/financeiro/page.tsx"), /highlightId=\{sp\.saque/);
    assert.match(source("src/components/withdrawals/admin-saques-panel.tsx"), /id=\{`saque-\$\{w\.id\}`\}/);
    assert.equal(tradeInTone("pending"), "lavender");
    assert.equal(tradeInTone("approved"), "success");
    assert.equal(tradeInTone("rejected"), "danger");
    assert.equal(withdrawalTone("cancelled"), "neutral");
    assert.equal(withdrawalTone("rejected"), "danger");
  });

  test("referred clients merge profiles and referral rows, newest first", () => {
    const rows = mergeReferredClients(
      [
        { id: "a", full_name: "Ana", created_at: "2026-09-01T00:00:00.000Z" },
        { id: "b", full_name: "  ", created_at: "2026-08-01T00:00:00.000Z" },
      ],
      [
        { referred_id: "a", status: "completed", created_at: "2026-09-02T00:00:00.000Z" },
        { referred_id: "c", status: "pending", created_at: "2026-10-01T00:00:00.000Z" },
      ],
      { c: "Carla" },
    );
    assert.deepEqual(
      rows.map((r) => [r.id, r.full_name, r.status]),
      [
        ["c", "Carla", "pending"],
        ["a", "Ana", "completed"],
        ["b", "Sem nome", null],
      ],
    );
  });

  test("client birth date keeps its calendar day in Brazil time", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/Sao_Paulo";
    try {
      assert.equal(formatDateBR("1992-05-20"), "20/05/1992");
      assert.equal(formatDateBR("2026-10-19T15:00:00.000Z"), "19/10/2026");
      assert.equal(formatDateBR(null), "—");
      assert.equal(formatDateBR("não é data"), "—");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
    assert.match(
      source("src/components/clients/client-detail-view.tsx"),
      /formatDateBR as formatDate/,
    );
  });

  test("admin financeiro loads in mock mode without calling the Supabase server client", () => {
    const closing = source("src/lib/finance/closing.ts");
    const body = closing.slice(closing.indexOf("export async function listClosings"));
    const guard = body.indexOf("if (USE_MOCK_AUTH) return { closings: [], error: null };");
    assert.ok(guard > 0, "listClosings returns early in mock mode");
    assert.ok(guard < body.indexOf("await createClient()"));
    const withdrawals = source("src/lib/withdrawals/queries.ts");
    const list = withdrawals.slice(withdrawals.indexOf("export async function listWithdrawalRequests"));
    assert.ok(list.indexOf("if (USE_MOCK_AUTH)") < list.indexOf("await createClient()"));
  });

  test("client totals ignore cancelled and switched reservations", () => {
    assert.deepEqual(
      clientTotals([
        { status: "ativa", amount_paid_cents: 1000 },
        { status: "quitada", amount_paid_cents: 2000 },
        { status: "cancelada", amount_paid_cents: 500 },
        { status: "trocada", amount_paid_cents: 700 },
      ]),
      { reservation_count: 4, total_paid_cents: 3000 },
    );
  });
}
