import assert from "node:assert/strict";
import {
  dueDatePaid,
  goalAppliedInstallments,
  goalsMissingSchedule,
} from "../../src/lib/goals/whatsapp-schedule.ts";
import { templateLabel, templateNamePatch } from "../../src/lib/whatsapp/template-name.ts";

export default function suite(test) {
  test("a goal notice is not cancelled as paid by aportes made before the goal started", () => {
    const goal = {
      amount_cents: 600000,
      frequency: "monthly",
      plan_start_date: "2026-10-19",
      target_date: "2027-01-19",
    };
    const applied = goalAppliedInstallments(goal, [{ paidOn: "2026-09-01", amountCents: 900000 }]);
    assert.equal(dueDatePaid(applied, "2026-11-19"), false);
    assert.equal(dueDatePaid(applied, "2026-10-19"), false);
  });

  test("active goals saved before the schedule existed get one on the next cron run", () => {
    const plan = {
      amount_cents: 300000,
      frequency: "monthly",
      plan_start_date: "2026-10-18",
      target_date: "2027-03-11",
    };
    const goals = [
      { id: "old", status: "active", ...plan },
      { id: "scheduled", status: "active", ...plan },
      { id: "cancelled", status: "cancelled", ...plan },
      { id: "legacy", status: "active", ...plan, frequency: null },
    ];
    assert.deepEqual(
      goalsMissingSchedule(goals, new Set(["scheduled"])).map((goal) => goal.id),
      ["old"],
    );
  });

  test("saving a WhatsApp template keeps its stored name unless the admin renames it", () => {
    assert.equal(templateLabel("cobranca_lembrete"), "Cobranca Lembrete");
    assert.equal(templateNamePatch("cobranca_lembrete", "Cobranca Lembrete"), undefined);
    assert.equal(templateNamePatch("cobranca_lembrete", " cobranca_lembrete "), undefined);
    assert.equal(templateNamePatch("cobranca_lembrete", ""), undefined);
    assert.equal(templateNamePatch("cobranca_lembrete", "Lembrete novo"), "Lembrete novo");
  });
}
