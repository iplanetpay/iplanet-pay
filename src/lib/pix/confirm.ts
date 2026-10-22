import type { SupabaseClient } from "@supabase/supabase-js";

export type ConfirmResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; error: string };

/**
 * Caminho único de confirmação de aporte usado pelo webhook do Mercado Pago e pela
 * simulação de teste: confirm_contribution (saldo, meta, fichas via triggers) e os
 * mesmos avisos (e-mail, WhatsApp do 1º aporte, marcos do admin).
 * `supabase` é o cliente service role que o webhook já usa.
 */
export async function confirmContributionAsWebhook(
  supabase: SupabaseClient,
  contributionId: string,
): Promise<ConfirmResult> {
  const { data, error } = await supabase.rpc("confirm_contribution", {
    p_contribution_id: contributionId,
  });
  if (error) return { ok: false, error: error.message };

  const already = Boolean((data as { already_confirmed?: boolean } | null)?.already_confirmed);
  if (!already) {
    try {
      const { notifyAporteConfirmado } = await import("@/lib/email/notify");
      void notifyAporteConfirmado(contributionId);
    } catch {
      /* non-fatal */
    }
    try {
      const { notifyFirstAporteWhatsapp } = await import("@/lib/whatsapp/notify");
      void notifyFirstAporteWhatsapp(contributionId);
    } catch {
      /* non-fatal */
    }
    try {
      const { data: contrib } = await supabase
        .from("contributions")
        .select("reservation_id")
        .eq("id", contributionId)
        .maybeSingle();
      if (contrib?.reservation_id) {
        const { maybeNotifyAdminContributionMilestones } = await import(
          "@/lib/milestones/admin-whatsapp"
        );
        void maybeNotifyAdminContributionMilestones(contrib.reservation_id);
      }
    } catch {
      /* non-fatal */
    }
  }
  return { ok: true, alreadyConfirmed: already };
}
