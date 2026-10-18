import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { mockActiveGoalForReservation, mockListGoalsForUser } from "@/lib/goals/mock";
import { createClient } from "@/lib/supabase/server";
import type { PaymentGoal } from "@/types/database";

const GOAL_SELECT = `
  id,
  user_id,
  product_id,
  reservation_id,
  name,
  target_date,
  reminder_day,
  reminder_at,
  amount_cents,
  installment_cents,
  installments_count,
  frequency,
  plan_start_date,
  status,
  whatsapp_phone,
  created_at
`;

export async function listPaymentGoalsForUser(userId: string): Promise<PaymentGoal[]> {
  if (USE_MOCK_AUTH) return mockListGoalsForUser(userId);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payment_goals")
      .select(GOAL_SELECT)
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as PaymentGoal[];
  } catch {
    return [];
  }
}

export async function getActiveGoalForReservation(
  reservationId: string,
): Promise<PaymentGoal | null> {
  if (USE_MOCK_AUTH) return mockActiveGoalForReservation(reservationId);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payment_goals")
      .select(GOAL_SELECT)
      .eq("reservation_id", reservationId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as PaymentGoal;
  } catch {
    return null;
  }
}
