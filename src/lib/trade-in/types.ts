import type { USED_DEVICE_STATUS_LABEL } from "@/lib/trade-in/constants";
import type { BatteryHealthReason } from "@/lib/trade-in/devices";

export type UsedDeviceOfferStatus = keyof typeof USED_DEVICE_STATUS_LABEL;

export type UsedDeviceOffer = {
  id: string;
  user_id: string;
  reservation_id: string;
  device_model: string;
  imei: string;
  expected_value_cents: number;
  minimum_value_cents: number;
  maintenance_options: string[];
  liquid_exposure: boolean;
  photo_paths: string[];
  battery_health_pct: number | null;
  battery_health_reason: BatteryHealthReason | null;
  status: UsedDeviceOfferStatus;
  admin_message: string | null;
  approved_value_cents: number | null;
  reviewed_at: string | null;
  created_at: string;
};

export type UsedDeviceOfferWithProfile = UsedDeviceOffer & {
  client_name: string | null;
  client_phone: string | null;
};
