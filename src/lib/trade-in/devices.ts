import { MAX_USED_DEVICE_PHOTOS } from "./constants.ts";

/** Must match c_max_devices in create_used_device_offers (migration 030). */
export const MAX_TRADE_IN_DEVICES = 5;

export const BATTERY_HEALTH_REASONS = ["unknown", "not_applicable"] as const;

export type BatteryHealthReason = (typeof BATTERY_HEALTH_REASONS)[number];

export type BatteryHealth =
  | { pct: number; reason: null }
  | { pct: null; reason: BatteryHealthReason };

export function isBatteryHealthReason(value: unknown): value is BatteryHealthReason {
  return (BATTERY_HEALTH_REASONS as readonly unknown[]).includes(value);
}

export function batteryHealthReasonLabel(reason: BatteryHealthReason): string {
  switch (reason) {
    case "unknown":
      return "Não sei";
    case "not_applicable":
      return "Não se aplica";
    default: {
      const unhandled: never = reason;
      return unhandled;
    }
  }
}

export function batteryHealthLabel(offer: {
  battery_health_pct?: number | null;
  battery_health_reason?: BatteryHealthReason | null;
}): string {
  if (offer.battery_health_pct != null) return `${offer.battery_health_pct}%`;
  if (offer.battery_health_reason) return batteryHealthReasonLabel(offer.battery_health_reason);
  return "Não informado";
}

export function parseBatteryHealth(
  pctRaw: string | number | null | undefined,
  reasonRaw: string | null | undefined,
): { ok: true; value: BatteryHealth } | { ok: false; error: string } {
  const pct = pctRaw == null ? "" : String(pctRaw).replace("%", "").trim();
  const reason = reasonRaw?.trim() ?? "";
  if (reason) {
    if (!isBatteryHealthReason(reason) || pct) {
      return { ok: false, error: "Estado da bateria inválido." };
    }
    return { ok: true, value: { pct: null, reason } };
  }
  if (!pct) {
    return { ok: false, error: "Informe o estado da bateria." };
  }
  if (!/^\d{1,3}$/.test(pct) || Number(pct) > 100) {
    return {
      ok: false,
      error: "O estado da bateria deve ser um número inteiro entre 0 e 100.",
    };
  }
  return { ok: true, value: { pct: Number(pct), reason: null } };
}

export function parseBrlToCents(raw: string): number | null {
  const normalized = raw.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(normalized);
  if (!normalized || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function normalizeImei(raw: string): string {
  return raw.replace(/\s/g, "");
}

/** One device entry as sent by the client form. */
export type TradeInDeviceInput = {
  deviceModel: string;
  imei: string;
  expectedBrl: string;
  minimumBrl: string;
  maintenanceOptions: string[];
  liquidExposure: boolean | null;
  batteryHealthPct: string;
  batteryHealthReason: string | null;
  photoCount: number;
};

export type TradeInDevice = {
  deviceModel: string;
  imei: string;
  expectedCents: number;
  minimumCents: number;
  maintenanceOptions: string[];
  liquidExposure: boolean;
  battery: BatteryHealth;
};

export function validateTradeInDevice(
  input: TradeInDeviceInput,
): { ok: true; device: TradeInDevice } | { ok: false; error: string } {
  const deviceModel = input.deviceModel.trim();
  const imei = normalizeImei(input.imei);
  if (!deviceModel || !imei) return { ok: false, error: "Preencha modelo e IMEI." };

  const expectedCents = parseBrlToCents(input.expectedBrl);
  const minimumCents = parseBrlToCents(input.minimumBrl);
  if (!expectedCents || !minimumCents) {
    return { ok: false, error: "Informe valores esperado e mínimo válidos." };
  }
  if (minimumCents > expectedCents) {
    return { ok: false, error: "O valor mínimo não pode ser maior que o esperado." };
  }
  if (input.maintenanceOptions.length === 0) {
    return { ok: false, error: "Selecione ao menos uma opção de manutenção." };
  }
  if (input.liquidExposure === null) {
    return { ok: false, error: "Selecione Sim ou Não para exposição a líquidos." };
  }

  const battery = parseBatteryHealth(input.batteryHealthPct, input.batteryHealthReason);
  if (!battery.ok) return battery;

  if (input.photoCount === 0) return { ok: false, error: "Envie ao menos uma foto do aparelho." };
  if (input.photoCount > MAX_USED_DEVICE_PHOTOS) {
    return { ok: false, error: `Máximo de ${MAX_USED_DEVICE_PHOTOS} fotos.` };
  }

  return {
    ok: true,
    device: {
      deviceModel,
      imei,
      expectedCents,
      minimumCents,
      maintenanceOptions: input.maintenanceOptions,
      liquidExposure: input.liquidExposure,
      battery: battery.value,
    },
  };
}

/**
 * `liveImeis` are devices already pending or approved on the reservation;
 * `liveCount` counts them toward MAX_TRADE_IN_DEVICES.
 */
export function validateTradeInDevices(
  inputs: TradeInDeviceInput[],
  existing: { liveCount: number; liveImeis: string[] } = { liveCount: 0, liveImeis: [] },
): { ok: true; devices: TradeInDevice[] } | { ok: false; error: string } {
  if (inputs.length === 0) return { ok: false, error: "Informe ao menos um aparelho." };
  if (existing.liveCount + inputs.length > MAX_TRADE_IN_DEVICES) {
    return {
      ok: false,
      error: `Limite de ${MAX_TRADE_IN_DEVICES} aparelhos em avaliação ou aprovados por reserva.`,
    };
  }

  const seen = new Set(existing.liveImeis.map(normalizeImei));
  const devices: TradeInDevice[] = [];
  for (const [index, input] of inputs.entries()) {
    const prefix = inputs.length > 1 ? `Aparelho ${index + 1}: ` : "";
    const result = validateTradeInDevice(input);
    if (!result.ok) return { ok: false, error: `${prefix}${result.error}` };
    if (seen.has(result.device.imei)) {
      return {
        ok: false,
        error: `${prefix}Este IMEI já está neste envio ou em avaliação nesta reserva.`,
      };
    }
    seen.add(result.device.imei);
    devices.push(result.device);
  }
  return { ok: true, devices };
}
