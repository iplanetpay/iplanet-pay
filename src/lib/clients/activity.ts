import type { ReferralStatus } from "@/lib/referrals/types";
import type { ReservationStatus } from "@/lib/reservations/types";
import type { UsedDeviceOfferStatus } from "@/lib/trade-in/types";
import type { WithdrawalPayoutStatus, WithdrawalStatus } from "@/lib/withdrawals/types";

export type ClientArea = "admin" | "staff";

export type ClientReferredRow = {
  id: string;
  full_name: string;
  status: ReferralStatus | null;
  created_at: string | null;
};

export type ClientTradeInRow = {
  id: string;
  device_model: string;
  status: UsedDeviceOfferStatus;
  expected_value_cents: number;
  approved_value_cents: number | null;
  created_at: string;
};

export type ClientWithdrawalRow = {
  id: string;
  status: WithdrawalStatus;
  payout_status: WithdrawalPayoutStatus;
  refund_amount_cents: number;
  product_name: string | null;
  created_at: string;
};

export type ClientActivity = {
  referred: ClientReferredRow[];
  trade_ins: ClientTradeInRow[];
  withdrawals: ClientWithdrawalRow[];
};

export const EMPTY_ACTIVITY: ClientActivity = {
  referred: [],
  trade_ins: [],
  withdrawals: [],
};

type ActivityKind = "trade_in" | "withdrawal";

/** Staff has no Avaliação or Financeiro screens, so their rows are not links. */
export function clientActivityHref(
  area: ClientArea,
  kind: ActivityKind,
  id: string,
): string | null {
  switch (area) {
    case "staff":
      return null;
    case "admin":
      break;
    default: {
      const unreachable: never = area;
      return unreachable;
    }
  }
  const encoded = encodeURIComponent(id);
  switch (kind) {
    case "trade_in":
      return `/admin/avaliacao-usados?id=${encoded}`;
    case "withdrawal":
      return `/admin/financeiro?saque=${encoded}#saque-${encoded}`;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

export type ActivityTone = "lavender" | "success" | "danger" | "neutral";

export function tradeInTone(status: UsedDeviceOfferStatus): ActivityTone {
  switch (status) {
    case "pending":
      return "lavender";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function withdrawalTone(status: WithdrawalStatus): ActivityTone {
  switch (status) {
    case "pending":
      return "lavender";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "cancelled":
      return "neutral";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

/**
 * Referred clients come from `profiles.referred_by` and from the `referrals`
 * table; either can miss a row, so both are merged by referred id.
 */
export function mergeReferredClients(
  profiles: Array<{ id: string; full_name: string | null; created_at: string | null }>,
  referrals: Array<{ referred_id: string; status: ReferralStatus; created_at: string }>,
  names: Record<string, string | null> = {},
): ClientReferredRow[] {
  const rows = new Map<string, ClientReferredRow>();
  for (const p of profiles) {
    rows.set(p.id, {
      id: p.id,
      full_name: p.full_name?.trim() || "Sem nome",
      status: null,
      created_at: p.created_at,
    });
  }
  for (const r of referrals) {
    const current = rows.get(r.referred_id);
    rows.set(r.referred_id, {
      id: r.referred_id,
      full_name: current?.full_name ?? (names[r.referred_id]?.trim() || "Sem nome"),
      status: r.status,
      created_at: r.created_at ?? current?.created_at ?? null,
    });
  }
  return [...rows.values()].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
}

/** Date-only values (birth date) are calendar days: parsing them as UTC shifts them a day back in Brazil. */
export function formatDateBR(value: string | null | undefined): string {
  if (!value) return "—";
  const day = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

const UNPAID_STATUSES: ReservationStatus[] = ["cancelada", "trocada"];

/** Same rule as the client list: cancelled and switched reservations do not count as paid. */
export function clientTotals(
  reservations: Array<{ status: ReservationStatus; amount_paid_cents: number }>,
): { reservation_count: number; total_paid_cents: number } {
  return {
    reservation_count: reservations.length,
    total_paid_cents: reservations
      .filter((r) => !UNPAID_STATUSES.includes(r.status))
      .reduce((sum, r) => sum + (r.amount_paid_cents ?? 0), 0),
  };
}
