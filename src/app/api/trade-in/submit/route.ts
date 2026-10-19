import { NextResponse } from "next/server";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { getCurrentUser } from "@/lib/auth/session";
import { getReservationById } from "@/lib/reservations/queries";
import { createClient } from "@/lib/supabase/server";
import {
  validateTradeInDevices,
  type TradeInDeviceInput,
} from "@/lib/trade-in/devices";
import { mockInsertOffers } from "@/lib/trade-in/mock";
import { isLiveOffer } from "@/lib/trade-in/offer-state";
import { listUsedDeviceOffersForReservation } from "@/lib/trade-in/queries";

const BUCKET = "used-device-photos";
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

type DevicePayload = Omit<TradeInDeviceInput, "photoCount">;

function mapSubmitRpcError(message: string | undefined): string {
  if (!message) return "Não foi possível enviar.";
  const m = message.toLowerCase();
  if (m.includes("create_used_device_offers")) {
    return "Recurso de avaliação ainda não está ativo no banco. Aplique a migration 030_trade_in_multiple_devices.";
  }
  return message;
}

function parseDevices(raw: string): DevicePayload[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => {
      const d = (item ?? {}) as Record<string, unknown>;
      return {
        deviceModel: String(d.deviceModel ?? ""),
        imei: String(d.imei ?? ""),
        expectedBrl: String(d.expectedBrl ?? ""),
        minimumBrl: String(d.minimumBrl ?? ""),
        maintenanceOptions: Array.isArray(d.maintenanceOptions)
          ? d.maintenanceOptions.map(String)
          : [],
        liquidExposure: typeof d.liquidExposure === "boolean" ? d.liquidExposure : null,
        batteryHealthPct: d.batteryHealthPct == null ? "" : String(d.batteryHealthPct),
        batteryHealthReason: d.batteryHealthReason == null ? null : String(d.batteryHealthReason),
      };
    });
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Faça login." }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const reservationId = String(form.get("reservation_id") ?? "").trim();
    const payload = parseDevices(String(form.get("devices") ?? ""));
    if (!reservationId || !payload) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const files = payload.map((_, index) =>
      form
        .getAll(`photos_${index}`)
        .filter((f): f is File => f instanceof File && f.size > 0),
    );
    if (files.some((list) => list.some((file) => file.size > MAX_PHOTO_BYTES))) {
      return NextResponse.json(
        { ok: false, error: "Cada foto deve ter no máximo 6 MB." },
        { status: 400 },
      );
    }

    const { reservation, error: reservationError } = await getReservationById(reservationId);
    if (reservationError || !reservation) {
      return NextResponse.json(
        {
          ok: false,
          error: reservationError ?? "Reserva não encontrada.",
        },
        { status: 404 },
      );
    }
    if (reservation.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
    }
    if (reservation.status !== "ativa") {
      return NextResponse.json(
        { ok: false, error: "Só reservas ativas aceitam oferta de usado." },
        { status: 400 },
      );
    }

    const { offers: existing } = await listUsedDeviceOffersForReservation(reservationId, user.id);
    const live = existing.filter(isLiveOffer);
    const validated = validateTradeInDevices(
      payload.map((device, index) => ({ ...device, photoCount: files[index]!.length })),
      { liveCount: live.length, liveImeis: live.map((o) => o.imei) },
    );
    if (!validated.ok) {
      return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
    }
    const devices = validated.devices;

    if (USE_MOCK_AUTH) {
      const { ids } = mockInsertOffers({
        userId: user.id,
        reservationId,
        devices: devices.map((device, index) => ({ device, photoCount: files[index]!.length })),
      });
      return NextResponse.json({ ok: true, offer_ids: ids });
    }

    const supabase = await createClient();
    const uploaded: string[] = [];
    const removeUploaded = async () => {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    };

    const rpcDevices = [];
    for (const [index, device] of devices.entries()) {
      const offerId = crypto.randomUUID();
      const photoPaths: string[] = [];
      for (const [photoIndex, file] of files[index]!.entries()) {
        const ext = file.type.includes("png") ? "png" : "jpg";
        const path = `${user.id}/${offerId}/${photoIndex}.${ext}`;
        const bytes = Buffer.from(await file.arrayBuffer());
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
        if (uploadError) {
          await removeUploaded();
          return NextResponse.json(
            { ok: false, error: `Falha no upload: ${uploadError.message}` },
            { status: 400 },
          );
        }
        uploaded.push(path);
        photoPaths.push(path);
      }
      rpcDevices.push({
        id: offerId,
        device_model: device.deviceModel,
        imei: device.imei,
        expected_value_cents: device.expectedCents,
        minimum_value_cents: device.minimumCents,
        maintenance_options: device.maintenanceOptions,
        liquid_exposure: device.liquidExposure,
        photo_paths: photoPaths,
        battery_health_pct: device.battery.pct,
        battery_health_reason: device.battery.reason,
      });
    }

    const { data: rpcIds, error: rpcError } = await supabase.rpc("create_used_device_offers", {
      p_reservation_id: reservationId,
      p_devices: rpcDevices,
    });

    if (rpcError) {
      await removeUploaded();
      return NextResponse.json(
        { ok: false, error: mapSubmitRpcError(rpcError.message) },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      offer_ids: (rpcIds as string[] | null) ?? rpcDevices.map((d) => d.id),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Falha ao enviar." },
      { status: 500 },
    );
  }
}
