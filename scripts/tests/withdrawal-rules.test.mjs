import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isWithinFullRefundWindow,
  parseFeeConfig,
  splitWithdrawal,
} from "../../src/lib/withdrawals/fee-window.ts";
import {
  TERMS_OF_USE_PT,
  TERMS_VERSION,
  WITHDRAWAL_SOURCE_LABEL,
  isMissingColumnError,
  withdrawalSource,
} from "../../src/lib/withdrawals/types.ts";
import { TERMS_MARKDOWN } from "../../src/lib/terms/terms-markdown.ts";
import { parseTerms, termsPlainText } from "../../src/lib/terms/parse.ts";

const source = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const DAY = 86_400_000;
const NOW = new Date("2026-10-20T12:00:00-03:00");
const ago = (days, extraMs = 0) => new Date(NOW.getTime() - days * DAY - extraMs);

export default function suite(test) {
  test("withdrawal: aportes within 7 days are refunded in full", () => {
    const s = splitWithdrawal({
      requestedAt: NOW,
      feePct: 30,
      items: [
        { amountCents: 60_000, confirmedAt: ago(1) },
        { amountCents: 60_000, confirmedAt: ago(6) },
      ],
    });
    assert.deepEqual(
      [s.totalCents, s.fullRefundCents, s.discountedCents, s.feeCents, s.netCents],
      [120_000, 120_000, 0, 0, 120_000],
    );
  });

  test("withdrawal: 30% applies only to aportes older than 7 days (Termos 11.2 example)", () => {
    const s = splitWithdrawal({
      requestedAt: NOW,
      feePct: 30,
      items: [
        { amountCents: 50_000, confirmedAt: ago(3) },
        { amountCents: 150_000, confirmedAt: ago(20) },
      ],
    });
    assert.equal(s.fullRefundCents, 50_000);
    assert.equal(s.discountedCents, 150_000);
    assert.equal(s.feeCents, 45_000);
    assert.equal(s.netCents, 155_000);
    assert.equal(s.fullRefundCents + s.discountedCents, s.totalCents);
  });

  test("withdrawal: exactly 7 days is still full refund; a moment later is discounted", () => {
    assert.equal(isWithinFullRefundWindow(ago(7), NOW), true);
    assert.equal(isWithinFullRefundWindow(ago(7, 1), NOW), false);
    const s = splitWithdrawal({
      requestedAt: NOW,
      feePct: 30,
      items: [{ amountCents: 100_000, confirmedAt: ago(7, 1000) }],
    });
    assert.equal(s.feeCents, 30_000);
  });

  test("withdrawal: fee rate comes from settings (withdrawal_fee_pct), default 30 / 7 days", () => {
    assert.deepEqual(parseFeeConfig({}), { feePct: 30, windowDays: 7 });
    assert.deepEqual(
      parseFeeConfig({ withdrawal_fee_pct: "25", withdrawal_full_refund_days: "10" }),
      { feePct: 25, windowDays: 10 },
    );
    assert.deepEqual(parseFeeConfig({ withdrawal_fee_pct: "abc" }), { feePct: 30, windowDays: 7 });
    const s = splitWithdrawal({
      requestedAt: NOW,
      ...parseFeeConfig({ withdrawal_fee_pct: "25" }),
      items: [{ amountCents: 100_000, confirmedAt: ago(30) }],
    });
    assert.equal(s.feeCents, 25_000);
  });

  test("wallet withdrawal: full part is capped by credits from the last 7 days", () => {
    const s = splitWithdrawal({
      requestedAt: NOW,
      feePct: 30,
      amountCents: 100_000,
      items: [
        { amountCents: 40_000, confirmedAt: ago(2) },
        { amountCents: 200_000, confirmedAt: ago(40) },
      ],
    });
    assert.equal(s.fullRefundCents, 40_000);
    assert.equal(s.discountedCents, 60_000);
    assert.equal(s.feeCents, 18_000);
    assert.equal(s.netCents, 82_000);
  });

  test("wallet withdraw route uses the settings rate and the 7-day split, not a hardcoded 30", () => {
    const route = source("src/app/api/wallet/withdraw/route.ts");
    assert.match(route, /previewWalletWithdrawal/);
    assert.equal(route.includes("WITHDRAWAL_FEE_PCT_DEFAULT"), false);
    assert.match(route, /full_refund_cents: split\.fullRefundCents/);
    assert.match(source("src/lib/withdrawals/preview.ts"), /"withdrawal_fee_pct", "withdrawal_full_refund_days"/);
  });

  test("migration 037: RPC applies the fee only to aportes older than the window", () => {
    const sql = source("supabase/migrations/037_withdrawal_seven_day_window.sql");
    assert.match(sql, /get_setting_numeric\('withdrawal_fee_pct', 30\)/);
    assert.match(sql, /get_setting_int\('withdrawal_full_refund_days', 7\)/);
    assert.match(sql, /coalesce\(c\.confirmed_at, c\.created_at\) >= v_now - \(v_window \|\| ' days'\)::interval/);
    assert.match(sql, /v_discounted := v_total - v_recent/);
    assert.match(sql, /v_fee := round\(v_discounted::numeric/);
    assert.match(sql, /full_refund_cents \+ discounted_cents = total_paid_cents/);
    assert.equal(/disable row level security|set role|bypassrls/i.test(sql), false);
    assert.equal((sql.match(/^security definer$/gm) ?? []).length, 4);
    assert.match(sql, /v_user_id := auth\.uid\(\)/);
    assert.match(sql, /current_user_role\(\) is distinct from 'admin'/);
  });

  test("referral bonus: withdrawable only through an admin-approved Saques request", () => {
    const sql = source("supabase/migrations/037_withdrawal_seven_day_window.sql");
    assert.match(sql, /create or replace function public\.request_bonus_withdrawal/);
    assert.match(sql, /'bonus', v_balance, v_balance, 0/);
    assert.match(sql, /'pending', 'pending_admin', 'bônus de indicação'/);
    // rejeitar ou cancelar devolve o bônus retido
    assert.equal((sql.match(/referral_bonus_balance_cents = referral_bonus_balance_cents \+ v_req\.total_paid_cents/g) ?? []).length, 2);
    // aprovar saque de bônus/carteira não encerra a reserva âncora
    assert.match(sql, /if v_req\.source = 'reserva' then\s+update public\.reservations set status = 'sacada'/);
    assert.match(source("src/app/api/referrals/withdraw-bonus/route.ts"), /rpc\("request_bonus_withdrawal"/);
    assert.match(source("src/components/referrals/referral-bonus-card.tsx"), /mode="bonus"/);
  });

  test("admin Saques: customer name opens the Clientes detail and bonus is labelled", () => {
    const panel = source("src/components/withdrawals/admin-saques-panel.tsx");
    assert.match(panel, /import \{ ClientDetailView \} from "@\/components\/clients\/client-detail-view"/);
    assert.match(panel, /setClientId\(w\.user_id\)/);
    assert.match(panel, /<ClientDetailView\s+clientId=\{clientId\}\s+area="admin"/);
    assert.match(panel, /<SourceBadge source=\{withdrawalSource\(w\)\}/);
    assert.match(panel, /fullRefundCents=\{w\.full_refund_cents\}/);
    assert.equal(WITHDRAWAL_SOURCE_LABEL.bonus, "Bônus de indicação");
    assert.equal(withdrawalSource({ admin_notes: "carteira" }), "carteira");
    assert.equal(withdrawalSource({ source: "bonus" }), "bonus");
    assert.equal(withdrawalSource({}), "reserva");
    assert.equal(isMissingColumnError('column withdrawal_requests.source does not exist'), true);
  });

  test("request screen shows the full / discounted / fee / net breakdown", () => {
    const btn = source("src/components/withdrawals/request-saque-button.tsx");
    assert.match(btn, /\/api\/withdrawals\/preview\?reservation_id=/);
    assert.match(btn, /fullRefundCents=\{split\.fullRefundCents\}/);
    const view = source("src/components/withdrawals/withdrawal-fee-breakdown.tsx");
    for (const label of ["Reembolso integral", "Com desconto", "Taxa administrativa", "Você receberá"]) {
      assert.ok(view.includes(label), label);
    }
    assert.match(source("src/components/wallet/wallet-actions.tsx"), /WithdrawalFeeBreakdown/);
  });

  test("approval password fallback stays 1234", () => {
    assert.match(source("src/lib/withdrawals/mutations.ts"), /WITHDRAWAL_APPROVE_PASSWORD\?\.trim\(\) \|\| "1234"/);
  });

  test("Termos platform-v4: site text is the published markdown", () => {
    assert.equal(TERMS_VERSION, "platform-v4");
    assert.equal(TERMS_MARKDOWN, source("docs/termos-de-uso.md"));
    assert.match(TERMS_MARKDOWN, /\*\*Versão:\*\* platform-v4/);
    assert.equal(TERMS_OF_USE_PT, termsPlainText());
    assert.equal(TERMS_OF_USE_PT.includes("**"), false);
    const anchor = parseTerms().find((b) => b.kind === "heading" && b.id === "contrato-de-aporte");
    assert.equal(anchor?.text, "8. Contrato de Aporte");
    assert.ok((TERMS_MARKDOWN.match(/\[PREENCHER/g) ?? []).length >= 10);
    assert.match(source("src/app/api/auth/signup/route.ts"), /body\.terms_version \|\| TERMS_VERSION/);
    assert.equal(source("src/app/api/auth/signup/route.ts").includes("withdrawal-v1"), false);
  });

  test("Termos 10.2 / 11.2 / 11.5 / 11.9 describe the new rules", () => {
    const md = TERMS_MARKDOWN;
    const clause = (n) => md.slice(md.indexOf(`${n}. `), md.indexOf("\n", md.indexOf(`${n}. `)));
    assert.match(clause("10.2"), /só pode ser sacado com aprovação do admin\*\*, na tela \*\*Saques\*\*/);
    const c112 = md.slice(md.indexOf("11.2."), md.indexOf("11.3."));
    assert.match(c112, /há 7 dias ou menos\*\* da data do pedido de saque são devolvidos \*\*integralmente/);
    assert.match(c112, /há mais de 7 dias\*\* da data do pedido, a iPlanet \*\*retém 30%/);
    assert.match(c112, /o usuário recebe \*\*R\$ 1\.550,00\*\*/);
    assert.match(clause("11.5"), /reembolso integral dos créditos lançados na carteira há 7 dias ou menos/);
    assert.match(clause("11.5"), /aprovação do admin/);
    assert.match(clause("11.9"), /devolvido \*\*integralmente\*\*, sem a taxa de 30%/);
    assert.equal(clause("11.9").includes("confirmar com o jurídico — reembolso integral"), false);
  });
}
