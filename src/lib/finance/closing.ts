import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export type FinancialClosing = {
  id: string;
  period_start: string;
  period_end: string;
  total_revenue_cents: number;
  total_contributions_count: number;
  total_withdrawals_cents: number;
  net_cents: number;
  notes: string | null;
  created_at: string;
};

export async function previewClosing(
  periodStart: string,
  periodEnd: string,
): Promise<{
  total_revenue_cents: number;
  total_contributions_count: number;
  total_withdrawals_cents: number;
  net_cents: number;
  error: string | null;
}> {
  const supabase = await createClient();
  const start = `${periodStart}T00:00:00.000Z`;
  const end = `${periodEnd}T23:59:59.999Z`;

  const { data: contribs, error: cErr } = await supabase
    .from("contributions")
    .select("amount_cents")
    .eq("status", "confirmed")
    .gte("created_at", start)
    .lte("created_at", end);

  if (cErr) {
    return {
      total_revenue_cents: 0,
      total_contributions_count: 0,
      total_withdrawals_cents: 0,
      net_cents: 0,
      error: cErr.message,
    };
  }

  const total_revenue_cents = (contribs ?? []).reduce(
    (s: number, c: { amount_cents: number }) => s + c.amount_cents,
    0,
  );

  const { data: withdrawals, error: wErr } = await supabase
    .from("withdrawal_requests")
    .select("refund_amount_cents, fee_amount_cents")
    .eq("status", "approved")
    .gte("processed_at", start)
    .lte("processed_at", end);

  if (wErr) {
    return {
      total_revenue_cents,
      total_contributions_count: contribs?.length ?? 0,
      total_withdrawals_cents: 0,
      net_cents: total_revenue_cents,
      error: wErr.message,
    };
  }

  const total_withdrawals_cents = (withdrawals ?? []).reduce(
    (
      s: number,
      w: { refund_amount_cents: number; fee_amount_cents: number },
    ) => s + w.refund_amount_cents + w.fee_amount_cents,
    0,
  );

  return {
    total_revenue_cents,
    total_contributions_count: contribs?.length ?? 0,
    total_withdrawals_cents,
    net_cents: total_revenue_cents - total_withdrawals_cents,
    error: null,
  };
}

export async function createClosing(params: {
  periodStart: string;
  periodEnd: string;
  notes?: string;
  adminUserId: string;
}): Promise<{ closing: FinancialClosing | null; error: string | null }> {
  const preview = await previewClosing(params.periodStart, params.periodEnd);
  if (preview.error) return { closing: null, error: preview.error };

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e) {
    return {
      closing: null,
      error: e instanceof Error ? e.message : "Service role indisponível",
    };
  }

  const { data, error } = await supabase
    .from("financial_closings")
    .insert({
      period_start: params.periodStart,
      period_end: params.periodEnd,
      total_revenue_cents: preview.total_revenue_cents,
      total_contributions_count: preview.total_contributions_count,
      total_withdrawals_cents: preview.total_withdrawals_cents,
      net_cents: preview.net_cents,
      notes: params.notes ?? null,
      closed_by: params.adminUserId,
    })
    .select("*")
    .single();

  if (error) return { closing: null, error: error.message };
  return { closing: data as FinancialClosing, error: null };
}

export async function listClosings(): Promise<{
  closings: FinancialClosing[];
  error: string | null;
}> {
  if (USE_MOCK_AUTH) return { closings: [], error: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_closings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) return { closings: [], error: error.message };
  return { closings: (data ?? []) as FinancialClosing[], error: null };
}
