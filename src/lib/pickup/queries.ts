import { createServiceClient } from "@/lib/supabase/admin";
import {
  fulfillmentStatusLabel,
  isFulfillmentMode,
  isFulfillmentStatus,
} from "@/lib/pickup/fulfillment";

export type PickupRequestRow = {
  id: string;
  mode: "store" | "shipping";
  status: string;
  shipping_method: string | null;
  freight_cents: number;
  insurance_cents: number;
  created_at: string;
};

export function pickupStatusLabel(status: string, mode: string = "store"): string {
  if (!isFulfillmentStatus(status)) return status;
  return fulfillmentStatusLabel(status, isFulfillmentMode(mode) ? mode : "store");
}

export async function getLatestPickupRequest(
  reservationId: string,
): Promise<PickupRequestRow | null> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("pickup_requests")
      .select(
        "id, mode, status, shipping_method, freight_cents, insurance_cents, created_at",
      )
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}
