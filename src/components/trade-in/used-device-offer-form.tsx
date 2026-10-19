"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Info, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { validateTradeInDevices } from "@/lib/trade-in/devices";
import {
  UsedDeviceFields,
  emptyUsedDeviceDraft,
  type UsedDeviceDraft,
} from "@/components/trade-in/used-device-fields";

export function UsedDeviceOfferForm({
  reservationId,
  backHref,
  liveCount,
  liveImeis,
  maxDevices,
}: {
  reservationId: string;
  backHref: string;
  /** Devices already pending or approved on this reservation. */
  liveCount: number;
  liveImeis: string[];
  maxDevices: number;
}) {
  const router = useRouter();
  const [devices, setDevices] = useState<UsedDeviceDraft[]>(() => [emptyUsedDeviceDraft()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slotsLeft = Math.max(0, maxDevices - liveCount);
  const canAddDevice = devices.length < slotsLeft;

  function updateDevice(key: string, patch: Partial<UsedDeviceDraft>) {
    setDevices((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function removeDevice(key: string) {
    setDevices((prev) => (prev.length > 1 ? prev.filter((d) => d.key !== key) : prev));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = devices.map((d) => ({
      deviceModel: d.deviceModel,
      imei: d.imei,
      expectedBrl: d.expectedBrl,
      minimumBrl: d.minimumBrl,
      maintenanceOptions: d.maintenance,
      liquidExposure: d.liquidExposure,
      batteryHealthPct: d.batteryHealthPct,
      batteryHealthReason: d.batteryHealthReason,
    }));
    const check = validateTradeInDevices(
      payload.map((p, i) => ({ ...p, photoCount: devices[i]!.photos.length })),
      { liveCount, liveImeis },
    );
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("reservation_id", reservationId);
      fd.set("devices", JSON.stringify(payload));
      devices.forEach((d, i) => {
        for (const file of d.photos) fd.append(`photos_${i}`, file);
      });

      const res = await fetch("/api/trade-in/submit", { method: "POST", body: fd });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível enviar.");
        return;
      }
      router.push(backHref);
      router.refresh();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-2xl space-y-6 pb-8">
      <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
        Envie fotos e detalhes do seu aparelho atual para usá-lo como forma de pagamento na sua
        reserva. Você pode oferecer mais de um aparelho.
      </p>

      <Card className="border-[var(--accent)]/25 bg-[var(--accent)]/5">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <Info className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          Como funciona?
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
          Você preenche as informações e nós fazemos uma proposta para cada aparelho. O valor de
          cada aparelho aceito é somado e abatido do saldo da sua reserva imediatamente. Os
          aparelhos antigos só são recolhidos na entrega do seu novo aparelho.
        </p>
      </Card>

      {devices.map((device, index) => (
        <UsedDeviceFields
          key={device.key}
          device={device}
          index={index}
          showHeader={devices.length > 1 || liveCount > 0}
          onChange={(patch) => updateDevice(device.key, patch)}
          onRemove={devices.length > 1 ? () => removeDevice(device.key) : null}
        />
      ))}

      {canAddDevice ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setDevices((prev) => [...prev, emptyUsedDeviceDraft()])}
        >
          Adicionar outro aparelho
        </Button>
      ) : (
        <p className="text-center text-xs text-[var(--ink-muted)]">
          Limite de {maxDevices} aparelhos em avaliação ou aprovados por reserva.
        </p>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
        {loading
          ? "Enviando…"
          : devices.length > 1
            ? `Enviar ${devices.length} aparelhos para avaliação`
            : "Enviar solicitação"}
      </Button>
    </form>
  );
}
