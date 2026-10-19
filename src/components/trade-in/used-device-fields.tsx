"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { BatteryMedium, CloudUpload, Droplets, Trash2, Wrench, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MAINTENANCE_OPTIONS,
  MAX_USED_DEVICE_PHOTOS,
  type MaintenanceOptionId,
} from "@/lib/trade-in/constants";
import {
  BATTERY_HEALTH_REASONS,
  batteryHealthReasonLabel,
  type BatteryHealthReason,
} from "@/lib/trade-in/devices";

export type UsedDeviceDraft = {
  key: string;
  deviceModel: string;
  imei: string;
  expectedBrl: string;
  minimumBrl: string;
  maintenance: MaintenanceOptionId[];
  /** null = not chosen yet */
  liquidExposure: boolean | null;
  batteryHealthPct: string;
  batteryHealthReason: BatteryHealthReason | null;
  photos: File[];
};

export function emptyUsedDeviceDraft(): UsedDeviceDraft {
  return {
    key: crypto.randomUUID(),
    deviceModel: "",
    imei: "",
    expectedBrl: "",
    minimumBrl: "",
    maintenance: ["nunca_aberto"],
    liquidExposure: null,
    batteryHealthPct: "",
    batteryHealthReason: null,
    photos: [],
  };
}

export function UsedDeviceFields({
  device,
  index,
  showHeader,
  onChange,
  onRemove,
}: {
  device: UsedDeviceDraft;
  index: number;
  showHeader: boolean;
  onChange: (patch: Partial<UsedDeviceDraft>) => void;
  onRemove: (() => void) | null;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { photos } = device;
  const maintenanceSet = useMemo(() => new Set(device.maintenance), [device.maintenance]);

  const photoPreviews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos],
  );

  useEffect(() => {
    return () => {
      for (const p of photoPreviews) URL.revokeObjectURL(p.url);
    };
  }, [photoPreviews]);

  function toggleMaintenance(id: MaintenanceOptionId) {
    if (id === "nunca_aberto") {
      onChange({ maintenance: ["nunca_aberto"] });
      return;
    }
    const next = device.maintenance.filter((x) => x !== "nunca_aberto");
    onChange({
      maintenance: next.includes(id) ? next.filter((x) => x !== id) : [...next, id],
    });
  }

  function onPhotosChange(list: FileList | null) {
    if (!list?.length) return;
    const merged = [...photos];
    for (const file of Array.from(list)) {
      if (merged.length >= MAX_USED_DEVICE_PHOTOS) break;
      const duplicate = merged.some(
        (f) =>
          f.name === file.name &&
          f.size === file.size &&
          f.lastModified === file.lastModified,
      );
      if (!duplicate) merged.push(file);
    }
    onChange({ photos: merged });
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  const label = `Aparelho ${index + 1}`;

  return (
    <section className="space-y-4" aria-label={label}>
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--ink)]">
            {label}
            {device.deviceModel.trim() ? (
              <span className="font-normal text-[var(--ink-muted)]"> · {device.deviceModel.trim()}</span>
            ) : null}
          </h2>
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)] transition hover:border-red-300 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover aparelho
            </button>
          ) : null}
        </div>
      ) : null}

      <Card className="space-y-5">
        <Field label="Modelo do aparelho">
          <Input
            placeholder="Ex: iPhone 11 Pro 64GB"
            value={device.deviceModel}
            onChange={(e) => onChange({ deviceModel: e.target.value })}
            required
          />
        </Field>

        <Field label="IMEI do aparelho">
          <Input
            placeholder="Digite o IMEI (digite *#06# no celular para ver)"
            value={device.imei}
            onChange={(e) => onChange({ imei: e.target.value })}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor esperado (R$)">
            <Input
              inputMode="decimal"
              placeholder="Ex: 1500"
              value={device.expectedBrl}
              onChange={(e) => onChange({ expectedBrl: e.target.value })}
              required
            />
          </Field>
          <Field label="Valor mínimo aceito (R$)">
            <Input
              inputMode="decimal"
              placeholder="Ex: 1200"
              value={device.minimumBrl}
              onChange={(e) => onChange({ minimumBrl: e.target.value })}
              required
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <BatteryMedium className="h-4 w-4 text-[var(--ink-muted)]" />
          Estado da bateria
        </p>
        <p className="text-sm text-[var(--ink-muted)]">
          No iPhone: Ajustes › Bateria › Saúde da bateria. Se o aparelho não mostra essa
          informação (alguns iPads e Macs), escolha uma opção abaixo.
        </p>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          placeholder="Ex: 87"
          aria-label={`Estado da bateria (%) do ${label}`}
          value={device.batteryHealthPct}
          disabled={device.batteryHealthReason !== null}
          onChange={(e) =>
            onChange({ batteryHealthPct: e.target.value, batteryHealthReason: null })
          }
          hint="Porcentagem de 0 a 100."
        />
        <div className="grid grid-cols-2 gap-3">
          {BATTERY_HEALTH_REASONS.map((reason) => (
            <ChoiceButton
              key={reason}
              selected={device.batteryHealthReason === reason}
              onClick={() =>
                onChange(
                  device.batteryHealthReason === reason
                    ? { batteryHealthReason: null }
                    : { batteryHealthReason: reason, batteryHealthPct: "" },
                )
              }
              label={batteryHealthReasonLabel(reason)}
            />
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <Wrench className="h-4 w-4 text-[var(--ink-muted)]" />
          Qual(is) manutenção(ões) o aparelho já sofreu?
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MAINTENANCE_OPTIONS.map((opt) => {
            const selected = maintenanceSet.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleMaintenance(opt.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--ink)]"
                    : "border-[var(--line)] bg-white text-[var(--ink-muted)] hover:border-[var(--accent)]/40"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent)]"
                      : "border-[var(--line)]"
                  }`}
                >
                  {selected ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  ) : null}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <Droplets className="h-4 w-4 text-[var(--ink-muted)]" />
          Exposição a líquidos
        </p>
        <p className="text-sm text-[var(--ink-muted)]">
          O aparelho já caiu na água ou pegou umidade severa?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ChoiceButton
            selected={device.liquidExposure === false}
            onClick={() => onChange({ liquidExposure: false })}
            label="Não"
          />
          <ChoiceButton
            selected={device.liquidExposure === true}
            onClick={() => onChange({ liquidExposure: true })}
            label="Sim"
            tone="danger"
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-semibold text-[var(--ink)]">
          Fotos do aparelho (frente, verso, detalhes)
        </p>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-10 text-center transition hover:border-[var(--accent)]/50">
          <CloudUpload className="h-8 w-8 text-[var(--ink-muted)]" />
          <span className="text-sm font-medium text-[var(--ink)]">
            Clique para selecionar até {MAX_USED_DEVICE_PHOTOS} fotos
          </span>
          <span className="text-xs text-[var(--ink-muted)]">
            Gabinete, tela ligada, avarias (se houver).
          </span>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={photos.length >= MAX_USED_DEVICE_PHOTOS}
            onChange={(e) => onPhotosChange(e.target.files)}
          />
        </label>

        {photos.length >= MAX_USED_DEVICE_PHOTOS ? (
          <p className="text-xs text-[var(--ink-muted)]">
            Limite de {MAX_USED_DEVICE_PHOTOS} fotos atingido. Remova uma para adicionar outra.
          </p>
        ) : photos.length > 0 ? (
          <p className="text-xs text-[var(--ink-muted)]">
            {photos.length} de {MAX_USED_DEVICE_PHOTOS} — clique acima para adicionar mais.
          </p>
        ) : null}

        {photoPreviews.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photoPreviews.map((preview, photoIndex) => (
              <div
                key={`${preview.file.name}-${photoIndex}`}
                className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--line)] bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.url}
                  alt={`Foto ${photoIndex + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onChange({ photos: photos.filter((_, i) => i !== photoIndex) })}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-90 transition hover:bg-black/80"
                  aria-label={`Remover foto ${photoIndex + 1}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      {children}
    </label>
  );
}

function ChoiceButton({
  selected,
  onClick,
  label,
  tone = "default",
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  tone?: "default" | "danger";
}) {
  const selectedClass =
    tone === "danger"
      ? "border-red-500 bg-red-50 text-red-900"
      : "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--ink)]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
        selected
          ? selectedClass
          : "border-[var(--line)] bg-white text-[var(--ink-muted)] hover:border-[var(--accent)]/40"
      }`}
    >
      {label}
    </button>
  );
}
