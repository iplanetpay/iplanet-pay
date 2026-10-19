import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_GOAL_NOTICE_BODIES,
  decideScheduleRow,
  dueDatePaid,
  goalAppliedInstallments,
  isGoalNoticeTemplate,
  renderGoalNotice,
  type GoalScheduleKind,
  type GoalScheduleRow,
} from "@/lib/goals/whatsapp-schedule";
import { calendarToday, isoDateInTimeZone } from "@/lib/reservations/contribution-plan";
import { formatCentsBRL } from "@/lib/utils";
import { enqueueWhatsapp } from "@/lib/whatsapp/client";
import type { PaymentGoalStatus } from "@/types/database";

type DueGoal = {
  id: string;
  user_id: string;
  name: string;
  status: PaymentGoalStatus;
  amount_cents: number;
  frequency: string | null;
  plan_start_date: string | null;
  target_date: string;
  whatsapp_phone: string | null;
  reservation_id: string | null;
  product: { name?: string } | null;
};

export type GoalScheduleRunResult = {
  sent: number;
  failed: number;
  cancelled: number;
};

/**
 * Sends pending notices whose send day arrived. A row is claimed (pending → sent)
 * before the message goes out, so overlapping cron runs cannot send it twice.
 */
export async function processDueGoalSchedule(
  admin: SupabaseClient,
  today: string = calendarToday(),
  limit = 100,
): Promise<GoalScheduleRunResult> {
  const result: GoalScheduleRunResult = { sent: 0, failed: 0, cancelled: 0 };

  const { data: due, error } = await admin
    .from("goal_whatsapp_schedule")
    .select("*")
    .eq("status", "pending")
    .lte("send_on", today)
    .order("send_on", { ascending: true })
    .limit(limit);
  if (error) {
    console.warn("[goal-schedule] cron", error.message);
    return result;
  }
  const rows = (due ?? []) as GoalScheduleRow[];
  if (rows.length === 0) return result;

  const goalIds = [...new Set(rows.map((row) => row.goal_id))];
  const { data: goalData } = await admin
    .from("payment_goals")
    .select(
      "id, user_id, name, status, amount_cents, frequency, plan_start_date, target_date, whatsapp_phone, reservation_id, product:products ( name )",
    )
    .in("id", goalIds);
  const goals = new Map(
    ((goalData ?? []) as unknown as DueGoal[]).map((goal) => [goal.id, goal] as const),
  );

  const userIds = [...new Set([...goals.values()].map((goal) => goal.user_id))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, full_name, phone").in("id", userIds)
    : { data: [] as Array<{ id: string; full_name: string | null; phone: string | null }> };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p] as const));

  const reservationIds = [
    ...new Set([...goals.values()].map((goal) => goal.reservation_id).filter(Boolean)),
  ] as string[];
  const { data: contributions } = reservationIds.length
    ? await admin
        .from("contributions")
        .select("reservation_id, amount_cents, status, confirmed_at, created_at")
        .in("reservation_id", reservationIds)
        .eq("status", "confirmed")
    : { data: [] as Array<{ reservation_id: string; amount_cents: number; status: string; confirmed_at: string | null; created_at: string }> };
  const paidByReservation = new Map<string, { paidOn: string; amountCents: number }[]>();
  for (const c of contributions ?? []) {
    const paidOn = isoDateInTimeZone(c.confirmed_at ?? c.created_at);
    if (!paidOn || c.amount_cents <= 0) continue;
    const list = paidByReservation.get(c.reservation_id) ?? [];
    list.push({ paidOn, amountCents: c.amount_cents });
    paidByReservation.set(c.reservation_id, list);
  }

  const { data: templates } = await admin
    .from("whatsapp_templates")
    .select("id, name, body")
    .eq("active", true);
  const templateFor = (kind: GoalScheduleKind) =>
    (templates ?? []).find((tpl) => isGoalNoticeTemplate(String(tpl.name), kind)) ?? null;

  const appliedByGoal = new Map<string, ReturnType<typeof goalAppliedInstallments>>();

  for (const row of rows) {
    const goal = goals.get(row.goal_id);
    if (!goal) {
      await markRow(admin, row.id, "cancelled", "Meta não encontrada.");
      result.cancelled += 1;
      continue;
    }
    let applied = appliedByGoal.get(goal.id);
    if (!applied) {
      applied = goalAppliedInstallments(
        goal,
        goal.reservation_id ? (paidByReservation.get(goal.reservation_id) ?? []) : [],
      );
      appliedByGoal.set(goal.id, applied);
    }
    const decision = decideScheduleRow({
      row,
      today,
      goalStatus: goal.status,
      dueInPlan: applied.some((item) => item.dueDate === row.due_date),
      paid: dueDatePaid(applied, row.due_date),
    });

    switch (decision.action) {
      case "ignore":
      case "wait":
        continue;
      case "cancel":
        await markRow(admin, row.id, "cancelled", decision.reason);
        result.cancelled += 1;
        continue;
      case "send":
        break;
      default: {
        const _exhaustive: never = decision;
        throw new Error(`Ação inválida: ${String(_exhaustive)}`);
      }
    }

    const profile = profileMap.get(goal.user_id);
    const phone = goal.whatsapp_phone || profile?.phone;
    if (!phone) {
      await markRow(admin, row.id, "failed", "Sem telefone.");
      result.failed += 1;
      continue;
    }

    const { data: claimed } = await admin
      .from("goal_whatsapp_schedule")
      .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const template = templateFor(row.kind);
    const installment = applied.find((item) => item.dueDate === row.due_date);
    const body = renderGoalNotice(template?.body ?? DEFAULT_GOAL_NOTICE_BODIES[row.kind], {
      meta: goal.name,
      reserva: goal.product?.name || "sua reserva",
      dueDate: row.due_date,
      nome: profile?.full_name?.split(" ")[0] || "olá",
      valor: installment ? formatCentsBRL(installment.dueCents) : "",
    });

    const queued = await enqueueWhatsapp({
      to_phone: phone,
      body,
      goal_id: goal.id,
      template_id: template?.id ?? null,
    });
    if (queued.ok && queued.sent) {
      result.sent += 1;
      continue;
    }
    const reason = !queued.ok
      ? queued.error
      : queued.skipped_api
        ? "Evolution não configurada"
        : "Não enviado";
    await admin
      .from("goal_whatsapp_schedule")
      .update({ status: "failed", sent_at: null, error: reason.slice(0, 500) })
      .eq("id", row.id);
    result.failed += 1;
  }

  return result;
}

async function markRow(
  admin: SupabaseClient,
  id: string,
  status: "cancelled" | "failed",
  error: string,
) {
  await admin
    .from("goal_whatsapp_schedule")
    .update({ status, error })
    .eq("id", id)
    .eq("status", "pending");
}
