import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { mockListGoalsForUser } from "@/lib/goals/mock";
import {
  mockInsertSchedule,
  mockPatchSchedule,
  mockScheduleForGoal,
  mockScheduleForUser,
} from "@/lib/goals/whatsapp-schedule-mock";
import {
  buildGoalSchedule,
  goalAcceptsNotices,
  goalPlanDueDates,
  goalsMissingSchedule,
  reconcileGoalSchedule,
  type GoalPlanFields,
  type GoalScheduleListItem,
  type GoalScheduleRow,
} from "@/lib/goals/whatsapp-schedule";
import { calendarToday } from "@/lib/reservations/contribution-plan";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import type { PaymentGoalStatus } from "@/types/database";

export type ScheduleGoal = GoalPlanFields & {
  id: string;
  user_id: string;
  status: PaymentGoalStatus;
};

/**
 * Builds the notice schedule from the goal plan and reconciles it with what is stored.
 * Never throws: a schedule failure must not block saving the goal.
 */
export async function syncGoalWhatsappSchedule(
  goal: ScheduleGoal,
  today: string = calendarToday(),
): Promise<void> {
  const desired = goalAcceptsNotices(goal.status)
    ? buildGoalSchedule({
        goalId: goal.id,
        userId: goal.user_id,
        dueDates: goalPlanDueDates(goal),
        today,
      })
    : [];

  if (USE_MOCK_AUTH) {
    const plan = reconcileGoalSchedule({ desired, existing: mockScheduleForGoal(goal.id) });
    const goalName =
      mockListGoalsForUser(goal.user_id).find((item) => item.id === goal.id)?.name ?? "Meta";
    mockInsertSchedule(
      plan.insert.map((row) => ({
        ...row,
        status: "pending",
        sent_at: null,
        error: null,
        goal_name: goalName,
      })),
    );
    mockPatchSchedule(plan.cancelIds, { status: "cancelled", error: "Plano alterado." });
    mockPatchSchedule(plan.reviveIds, { status: "pending", error: null });
    return;
  }

  const admin = tryCreateServiceClient();
  if (!admin) return;
  try {
    const { data: existing, error } = await admin
      .from("goal_whatsapp_schedule")
      .select("*")
      .eq("goal_id", goal.id);
    if (error) {
      console.warn("[goal-schedule]", error.message);
      return;
    }
    const plan = reconcileGoalSchedule({
      desired,
      existing: (existing ?? []) as GoalScheduleRow[],
    });
    if (plan.insert.length > 0) {
      await admin
        .from("goal_whatsapp_schedule")
        .upsert(plan.insert, { onConflict: "goal_id,due_date,kind", ignoreDuplicates: true });
    }
    if (plan.cancelIds.length > 0) {
      await admin
        .from("goal_whatsapp_schedule")
        .update({ status: "cancelled", error: "Plano alterado." })
        .in("id", plan.cancelIds)
        .eq("status", "pending");
    }
    if (plan.reviveIds.length > 0) {
      await admin
        .from("goal_whatsapp_schedule")
        .update({ status: "pending", error: null })
        .in("id", plan.reviveIds)
        .eq("status", "cancelled");
    }
  } catch (err) {
    console.warn("[goal-schedule]", err instanceof Error ? err.message : err);
  }
}

/** Creates the schedule for active goals that have none yet. Returns how many goals were filled in. */
export async function backfillGoalSchedules(today: string = calendarToday()): Promise<number> {
  if (USE_MOCK_AUTH) return 0;
  const admin = tryCreateServiceClient();
  if (!admin) return 0;
  try {
    const { data: goals, error } = await admin
      .from("payment_goals")
      .select("id, user_id, status, amount_cents, frequency, plan_start_date, target_date")
      .eq("status", "active")
      .not("frequency", "is", null)
      .not("plan_start_date", "is", null)
      .limit(500);
    if (error || !goals?.length) return 0;
    const { data: scheduled } = await admin
      .from("goal_whatsapp_schedule")
      .select("goal_id")
      .in(
        "goal_id",
        goals.map((goal) => goal.id),
      );
    const missing = goalsMissingSchedule(
      goals as ScheduleGoal[],
      new Set((scheduled ?? []).map((row) => String(row.goal_id))),
    );
    for (const goal of missing) await syncGoalWhatsappSchedule(goal, today);
    return missing.length;
  } catch (err) {
    console.warn("[goal-schedule]", err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function listGoalScheduleForUser(
  userId: string,
): Promise<{ rows: GoalScheduleListItem[]; error: string | null }> {
  if (USE_MOCK_AUTH) {
    return { rows: sortSchedule(mockScheduleForUser(userId)), error: null };
  }
  const admin = tryCreateServiceClient();
  if (!admin) return { rows: [], error: "Service role não configurada." };
  try {
    const { data, error } = await admin
      .from("goal_whatsapp_schedule")
      .select("*, goal:payment_goals ( name )")
      .eq("user_id", userId)
      .order("send_on", { ascending: true })
      .limit(500);
    if (error) return { rows: [], error: error.message };
    const rows = (data ?? []).map((row) => {
      const { goal, ...rest } = row as GoalScheduleRow & { goal: { name?: string } | null };
      return { ...rest, goal_name: goal?.name ?? "Meta" };
    });
    return { rows: sortSchedule(rows), error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Falha" };
  }
}

function sortSchedule(rows: GoalScheduleListItem[]): GoalScheduleListItem[] {
  return [...rows].sort(
    (a, b) => a.send_on.localeCompare(b.send_on) || a.kind.localeCompare(b.kind),
  );
}
