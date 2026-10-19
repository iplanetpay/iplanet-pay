import { getCurrentUser } from "@/lib/auth/session";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { mockUpsertGoal } from "@/lib/goals/mock";
import { nextReminderAt, parseReminderDay } from "@/lib/goals/reminder";
import { syncGoalWhatsappSchedule, type ScheduleGoal } from "@/lib/goals/whatsapp-schedule-store";
import { createClient } from "@/lib/supabase/server";
import type { ContributionFrequency } from "@/lib/reservations/contribution-plan";

export type CreateGoalInput = {
  product_id: string;
  name: string;
  target_date: string;
  /** Dia do mês 1–30; opcional */
  reminder_day?: number | null;
  /** @deprecated use reminder_day — still accepted for draft compat */
  reminder_at?: string | null;
  amount_cents: number;
  installment_cents: number;
  installments_count: number;
  whatsapp_phone?: string | null;
  reservation_id?: string | null;
  frequency?: ContributionFrequency | null;
  plan_start_date?: string | null;
  /** Quando preenchido, atualiza a meta ativa em vez de inserir outra */
  goal_id?: string | null;
};

export type CreateGoalResult =
  | { ok: true; goal_id: string }
  | { ok: false; error: string; needsAuth?: boolean };

export async function createPaymentGoal(
  input: CreateGoalInput,
): Promise<CreateGoalResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Entre para salvar a meta.", needsAuth: true };
  }

  if (!input.product_id || !input.name.trim() || !input.target_date) {
    return { ok: false, error: "Preencha nome, produto e data." };
  }
  if (
    !Number.isFinite(input.amount_cents) ||
    input.amount_cents <= 0 ||
    !Number.isFinite(input.installment_cents) ||
    input.installment_cents <= 0 ||
    !Number.isFinite(input.installments_count) ||
    input.installments_count < 1
  ) {
    return { ok: false, error: "Valores da meta inválidos." };
  }

  let reminderDay = parseReminderDay(input.reminder_day ?? null);
  if (reminderDay == null && input.reminder_at) {
    const d = new Date(input.reminder_at);
    if (!Number.isNaN(d.getTime())) {
      const day = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Sao_Paulo",
          day: "numeric",
        }).format(d),
      );
      reminderDay = Math.min(30, Math.max(1, day));
    }
  }

  const reminderAt =
    reminderDay != null ? nextReminderAt(reminderDay).toISOString() : null;

  const frequency = input.frequency ?? null;
  const planStartDate = input.plan_start_date ?? null;
  const whatsappPhone = input.whatsapp_phone || user.phone || null;
  const amountCents = Math.round(input.amount_cents);
  const installmentCents = Math.round(input.installment_cents);
  const installmentsCount = Math.round(input.installments_count);
  const reservationId = input.reservation_id ?? null;
  const scheduleGoal = (id: string): ScheduleGoal => ({
    id,
    user_id: user.id,
    status: "active",
    amount_cents: amountCents,
    frequency,
    plan_start_date: planStartDate,
    target_date: input.target_date,
  });

  if (USE_MOCK_AUTH) {
    const saved = mockUpsertGoal({
      userId: user.id,
      goalId: input.goal_id,
      productId: input.product_id,
      reservationId,
      name: input.name.trim(),
      targetDate: input.target_date,
      reminderDay,
      reminderAt,
      amountCents,
      installmentCents,
      installmentsCount,
      whatsappPhone,
      frequency,
      planStartDate,
    });
    if (!saved.ok) return saved;
    await syncGoalWhatsappSchedule(scheduleGoal(saved.id));
    return { ok: true, goal_id: saved.id };
  }

  const row: Record<string, unknown> = {
    product_id: input.product_id,
    reservation_id: reservationId,
    name: input.name.trim(),
    target_date: input.target_date,
    reminder_day: reminderDay,
    reminder_at: reminderAt,
    amount_cents: amountCents,
    installment_cents: installmentCents,
    installments_count: installmentsCount,
    whatsapp_phone: whatsappPhone,
    status: "active",
  };
  if (frequency) row.frequency = frequency;
  if (planStartDate) row.plan_start_date = planStartDate;

  try {
    const supabase = await createClient();
    const query = input.goal_id
      ? supabase
          .from("payment_goals")
          .update(row)
          .eq("id", input.goal_id)
          .eq("user_id", user.id)
          .select("id")
          .single()
      : supabase
          .from("payment_goals")
          .insert({ ...row, user_id: user.id })
          .select("id")
          .single();
    const { data, error } = await query;

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao salvar meta." };
    }
    const goalId = data.id as string;
    await syncGoalWhatsappSchedule(scheduleGoal(goalId));
    return { ok: true, goal_id: goalId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar meta";
    return { ok: false, error: message };
  }
}
