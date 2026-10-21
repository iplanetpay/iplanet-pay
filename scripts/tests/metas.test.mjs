import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGoalSchedule, goalContributions } from "../../src/lib/goals/goal-calendar.ts";
import { climbGoalFromPlan } from "../../src/lib/goals/climb/adapter.ts";
import { buildContributionPlan } from "../../src/lib/reservations/contribution-plan.ts";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

export default function suite(test) {
  test("a goal on a reservation in progress ignores aportes made before its start date", () => {
    const before = [
      { paidOn: "2026-08-02", amountCents: 450000 },
      { paidOn: "2026-09-10", amountCents: 300000 },
    ];
    assert.deepEqual(goalContributions(before, "2026-10-19"), []);
    assert.deepEqual(
      goalContributions([...before, { paidOn: "2026-10-19", amountCents: 5000 }], "2026-10-19"),
      [{ paidOn: "2026-10-19", amountCents: 5000 }],
    );

    const schedule = buildGoalSchedule({
      name: "Air 13",
      amountCents: 600000,
      startDate: "2026-10-19",
      targetDate: "2027-01-19",
      frequency: "monthly",
      contributions: before,
      today: "2026-10-19",
    });
    assert.equal(schedule.savedCents, 0);
    assert.equal(schedule.progressPercent, 0);
    assert.ok(schedule.calendar.dues.every((due) => due.status === "upcoming"));
    assert.ok(schedule.calendar.dues.every((due) => due.note === undefined));
    assert.equal(schedule.calendar.heroCents, 150000);
  });

  test("a new goal with no aporte does not mark the next months as paid on time", () => {
    const plan = buildContributionPlan({
      targetCents: 600000,
      contributedCents: 0,
      startDate: "2026-10-19",
      endDate: "2027-01-19",
      frequency: "monthly",
    });
    const goal = climbGoalFromPlan({
      id: "air-13",
      name: "Air 13",
      productName: "MacBook Air 13",
      targetCents: 600000,
      savedCents: 0,
      today: "2026-10-19",
      plan,
      contributions: [{ paidOn: "2026-09-01", amountCents: 900000 }],
    });
    assert.ok(goal.deposits.every((deposit) => deposit.status === "pending"));
    assert.equal(goal.streak, 0);
  });

  test("aportes after the start date still fill the goal calendar", () => {
    const schedule = buildGoalSchedule({
      name: "Air 13",
      amountCents: 600000,
      startDate: "2026-10-19",
      targetDate: "2027-01-19",
      frequency: "monthly",
      contributions: [
        { paidOn: "2026-10-01", amountCents: 900000 },
        { paidOn: "2026-10-19", amountCents: 150000 },
      ],
      today: "2026-10-20",
    });
    assert.equal(schedule.savedCents, 150000);
    assert.equal(schedule.progressPercent, 25);
    assert.equal(schedule.calendar.dues[0].status, "on_time");
    assert.equal(schedule.calendar.dues[1].status, "upcoming");
  });

  test("the metas side panel shows the next aporte already reduced by an early payment", () => {
    const plan = buildContributionPlan({
      targetCents: 30000,
      contributedCents: 0,
      startDate: "2026-10-19",
      endDate: "2026-12-19",
      frequency: "monthly",
    });
    const goal = climbGoalFromPlan({
      id: "meta",
      name: "Meta",
      productName: "iPhone 17",
      targetCents: 30000,
      savedCents: 15000,
      today: "2026-10-20",
      plan,
      contributions: [{ paidOn: "2026-10-19", amountCents: 15000 }],
    });
    assert.equal(goal.deposits[0].amount, 100);
    assert.equal(goal.deposits[1].amount, 50);
    assert.equal(goal.deposits[2].amount, 100);
  });

  test("the metas ring has no square outline and shows the percent in a blue ring", () => {
    const ring = source("src/components/goals/climb/progress-ring.tsx");
    assert.equal(/className="ring"/.test(ring), false, "Tailwind's ring utility draws a square");
    assert.match(ring, /className="progress-ring"/);
    assert.match(ring, /PROGRESS_RING_BLUE = '#0071e3'/);

    const grid = source("src/components/goals/climb/goal-grid.tsx");
    assert.equal(grid.includes("label={false}"), false);
    assert.match(grid, /color=\{PROGRESS_RING_BLUE\}/);
  });

  test("the metas screen drops the word topo and shows the aporte calendar", () => {
    assert.equal(source("src/components/goals/climb/rocket-scene.tsx").includes("Topo"), false);
    assert.equal(/topo/i.test(source("src/components/goals/climb/goal-stats.tsx")), false);
    assert.equal(/topo/i.test(source("src/app/app/metas/page.tsx")), false);
    assert.match(source("src/components/goals/climb/metas-screen.tsx"), /<ContributionCalendar/);
  });
}
