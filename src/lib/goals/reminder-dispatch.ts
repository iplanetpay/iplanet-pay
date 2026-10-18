import { enqueueWhatsapp, whatsappConfigured } from "@/lib/whatsapp/client";
import type { ReminderDecision } from "@/lib/goals/reminders";

export type ReminderDelivery =
  | { delivered: false; reason: "not_configured" | "nothing_to_send" | "failed" }
  | { delivered: true; reason: "sent" };

/**
 * Production gate. Pages, tests and browser checks must not call this.
 * Without Evolution credentials the sender returns before enqueue.
 */
export async function deliverContributionReminder(input: {
  phone: string;
  goalId: string;
  decision: ReminderDecision;
}): Promise<ReminderDelivery> {
  if (!input.decision.send || !input.decision.body) {
    return { delivered: false, reason: "nothing_to_send" };
  }
  if (!whatsappConfigured()) {
    return { delivered: false, reason: "not_configured" };
  }
  const queued = await enqueueWhatsapp({
    to_phone: input.phone,
    body: input.decision.body,
    goal_id: input.goalId,
  });
  if (!queued.ok || !queued.sent) {
    return { delivered: false, reason: "failed" };
  }
  return { delivered: true, reason: "sent" };
}
