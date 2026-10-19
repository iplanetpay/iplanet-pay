import assert from "node:assert/strict";
import {
  DEFAULT_GOAL_NOTICE_BODIES,
  buildGoalSchedule,
  decideScheduleRow,
  dueDatePaid,
  goalAppliedInstallments,
  goalPlanDueDates,
  isGoalNoticeTemplate,
  pendingScheduleIds,
  reconcileGoalSchedule,
  renderGoalNotice,
  scheduleSendOn,
} from "../../src/lib/goals/whatsapp-schedule.ts";
import { dayBeforeReminder, lateReminder } from "../../src/lib/goals/reminders.ts";
import {
  formatLeadPhoneList,
  selectedLeadPhones,
  toggleAllLeads,
  toggleLeadSelection,
} from "../../src/lib/whatsapp/lead-selection.ts";

const weeklyGoal = {
  amount_cents: 300_000,
  frequency: "weekly",
  plan_start_date: "2026-11-02",
  target_date: "2026-11-23",
};

function row(overrides) {
  return {
    id: "r1",
    goal_id: "g1",
    user_id: "u1",
    due_date: "2026-11-09",
    send_on: "2026-11-08",
    kind: "day_before",
    status: "pending",
    sent_at: null,
    error: null,
    created_at: "2026-10-19T12:00:00.000Z",
    ...overrides,
  };
}

export default function suite(test) {
  test("avisos de metas: véspera sai um dia antes; atraso no dia seguinte", () => {
    assert.equal(scheduleSendOn("2026-11-09", "day_before"), "2026-11-08");
    assert.equal(scheduleSendOn("2026-12-01", "day_before"), "2026-11-30");
    assert.equal(scheduleSendOn("2026-11-09", "late"), "2026-11-10");
  });

  test("avisos de metas: um aviso de véspera por data do plano", () => {
    const dates = goalPlanDueDates(weeklyGoal);
    assert.deepEqual(dates, ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    const rows = buildGoalSchedule({
      goalId: "g1",
      userId: "u1",
      dueDates: dates,
      today: "2026-10-19",
      kinds: ["day_before"],
    });
    assert.deepEqual(
      rows.map((r) => [r.due_date, r.send_on]),
      [
        ["2026-11-02", "2026-11-01"],
        ["2026-11-09", "2026-11-08"],
        ["2026-11-16", "2026-11-15"],
        ["2026-11-23", "2026-11-22"],
      ],
    );
    assert.ok(rows.every((r) => r.goal_id === "g1" && r.user_id === "u1"));
  });

  test("avisos de metas: datas passadas ficam fora e duplicadas viram uma", () => {
    const rows = buildGoalSchedule({
      goalId: "g1",
      userId: "u1",
      dueDates: ["2026-10-19", "2026-10-26", "2026-10-26", "2026-10-20"],
      today: "2026-10-19",
    });
    assert.deepEqual(
      rows.map((r) => `${r.due_date}|${r.kind}|${r.send_on}`),
      [
        "2026-10-19|late|2026-10-20",
        "2026-10-20|day_before|2026-10-19",
        "2026-10-20|late|2026-10-21",
        "2026-10-26|day_before|2026-10-25",
        "2026-10-26|late|2026-10-27",
      ],
    );
  });

  test("avisos de metas: meta sem cadência ou com plano inválido não agenda", () => {
    assert.deepEqual(goalPlanDueDates({ ...weeklyGoal, frequency: null }), []);
    assert.deepEqual(goalPlanDueDates({ ...weeklyGoal, plan_start_date: null }), []);
    assert.deepEqual(goalPlanDueDates({ ...weeklyGoal, target_date: "2026-11-01" }), []);
  });

  test("avisos de metas: mudança de plano cancela pendentes e insere novas datas", () => {
    const existing = [
      row({ id: "keep", due_date: "2026-11-09", send_on: "2026-11-08" }),
      row({ id: "drop", due_date: "2026-11-16", send_on: "2026-11-15" }),
      row({ id: "sent", due_date: "2026-11-02", send_on: "2026-11-01", status: "sent" }),
      row({ id: "back", due_date: "2026-11-30", send_on: "2026-11-29", status: "cancelled" }),
    ];
    const desired = buildGoalSchedule({
      goalId: "g1",
      userId: "u1",
      dueDates: ["2026-11-09", "2026-11-23", "2026-11-30"],
      today: "2026-10-19",
      kinds: ["day_before"],
    });
    const plan = reconcileGoalSchedule({ desired, existing });
    assert.deepEqual(plan.insert.map((r) => r.due_date), ["2026-11-23"]);
    assert.deepEqual(plan.cancelIds, ["drop"]);
    assert.deepEqual(plan.reviveIds, ["back"]);
  });

  test("avisos de metas: plano igual não gera nada novo", () => {
    const desired = buildGoalSchedule({
      goalId: "g1",
      userId: "u1",
      dueDates: ["2026-11-09"],
      today: "2026-10-19",
      kinds: ["day_before"],
    });
    const plan = reconcileGoalSchedule({ desired, existing: [row({})] });
    assert.deepEqual(plan, { insert: [], cancelIds: [], reviveIds: [] });
  });

  test("avisos de metas: meta encerrada cancela só os pendentes", () => {
    const existing = [
      row({ id: "a" }),
      row({ id: "b", status: "sent" }),
      row({ id: "c", due_date: "2026-11-16" }),
      row({ id: "d", status: "failed" }),
    ];
    assert.deepEqual(pendingScheduleIds(existing), ["a", "c"]);
    const plan = reconcileGoalSchedule({ desired: [], existing });
    assert.deepEqual(plan.cancelIds, ["a", "c"]);
  });

  test("avisos de metas: cron envia véspera no dia e espera antes", () => {
    const base = { goalStatus: "active", dueInPlan: true, paid: false };
    assert.deepEqual(decideScheduleRow({ ...base, row: row({}), today: "2026-11-07" }), {
      action: "wait",
    });
    assert.deepEqual(decideScheduleRow({ ...base, row: row({}), today: "2026-11-08" }), {
      action: "send",
    });
    assert.equal(
      decideScheduleRow({ ...base, row: row({}), today: "2026-11-09" }).action,
      "cancel",
    );
    assert.deepEqual(
      decideScheduleRow({ ...base, row: row({ status: "sent" }), today: "2026-11-08" }),
      { action: "ignore" },
    );
  });

  test("avisos de metas: aporte já feito cancela em vez de enviar", () => {
    const applied = goalAppliedInstallments(weeklyGoal, [
      { paidOn: "2026-11-02", amountCents: 75_000 },
      { paidOn: "2026-11-05", amountCents: 75_000 },
    ]);
    assert.equal(dueDatePaid(applied, "2026-11-02"), true);
    assert.equal(dueDatePaid(applied, "2026-11-09"), true);
    assert.equal(dueDatePaid(applied, "2026-11-16"), false);
    const decision = decideScheduleRow({
      row: row({}),
      today: "2026-11-08",
      goalStatus: "active",
      dueInPlan: true,
      paid: dueDatePaid(applied, "2026-11-09"),
    });
    assert.deepEqual(decision, { action: "cancel", reason: "Aporte já feito." });
  });

  test("avisos de metas: meta não ativa ou data fora do plano cancela", () => {
    for (const goalStatus of ["paused", "done", "cancelled"]) {
      const decision = decideScheduleRow({
        row: row({}),
        today: "2026-11-08",
        goalStatus,
        dueInPlan: true,
        paid: false,
      });
      assert.equal(decision.action, "cancel");
    }
    assert.equal(
      decideScheduleRow({
        row: row({}),
        today: "2026-11-08",
        goalStatus: "active",
        dueInPlan: false,
        paid: false,
      }).action,
      "cancel",
    );
  });

  test("avisos de metas: atraso sai no dia seguinte se não pagou", () => {
    const late = row({ kind: "late", send_on: "2026-11-10" });
    const base = { goalStatus: "active", dueInPlan: true };
    assert.deepEqual(decideScheduleRow({ ...base, row: late, today: "2026-11-10", paid: false }), {
      action: "send",
    });
    assert.equal(
      decideScheduleRow({ ...base, row: late, today: "2026-11-10", paid: true }).action,
      "cancel",
    );
  });

  test("avisos de metas: texto padrão igual ao lembrete existente", () => {
    const vars = { meta: "Meu iPhone", reserva: "iPhone 16", dueDate: "2026-11-09" };
    assert.equal(
      renderGoalNotice(DEFAULT_GOAL_NOTICE_BODIES.day_before, vars),
      dayBeforeReminder("iPhone 16", "Meu iPhone", "2026-11-09"),
    );
    assert.equal(
      renderGoalNotice(DEFAULT_GOAL_NOTICE_BODIES.late, vars),
      lateReminder("iPhone 16", "Meu iPhone", "2026-11-09"),
    );
  });

  test("avisos de metas: template renomeado pelo editor ainda é encontrado", () => {
    assert.equal(isGoalNoticeTemplate("meta_vespera", "day_before"), true);
    assert.equal(isGoalNoticeTemplate("Meta Vespera", "day_before"), true);
    assert.equal(isGoalNoticeTemplate("Meta Véspera", "day_before"), true);
    assert.equal(isGoalNoticeTemplate("Meta Atraso", "late"), true);
    assert.equal(isGoalNoticeTemplate("Meta Atraso", "day_before"), false);
    assert.equal(isGoalNoticeTemplate("cobranca_lembrete", "day_before"), false);
  });

  test("seleção de leads: números com 55, separados por vírgula", () => {
    assert.equal(
      formatLeadPhoneList(["(11) 99999-9999", "+55 21 98888-7777", "5511977776666"]),
      "5511999999999, 5521988887777, 5511977776666",
    );
  });

  test("seleção de leads: repetidos e inválidos ficam fora", () => {
    assert.deepEqual(
      selectedLeadPhones(["11999999999", "5511999999999", "", null, "12345", "99999-9999"]),
      ["5511999999999"],
    );
    assert.equal(formatLeadPhoneList([]), "");
  });

  test("seleção de leads: selecionar todos e desmarcar", () => {
    const ids = ["a", "b", "c"];
    let selected = toggleLeadSelection(new Set(), "b");
    assert.deepEqual([...selected], ["b"]);
    selected = toggleAllLeads(selected, ids);
    assert.deepEqual([...selected].sort(), ids);
    selected = toggleAllLeads(selected, ids);
    assert.equal(selected.size, 0);
    selected = toggleLeadSelection(toggleLeadSelection(selected, "a"), "a");
    assert.equal(selected.size, 0);
  });
}
