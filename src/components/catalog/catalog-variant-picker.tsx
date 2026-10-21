"use client";

import { Check } from "lucide-react";
import { isLightHex, swatchHex } from "@/lib/catalog/colors";
import {
  isComboAvailable,
  selectColor,
  selectStorage,
  type CatalogVariant,
  type VariantOptions,
} from "@/lib/catalog/variants";

/**
 * Cor (bolinhas com nome) e Armazenamento (chips). Combinações que não existem
 * ficam desabilitadas; trocar de cor ajusta o armazenamento para um disponível.
 */
export function CatalogVariantPicker({
  options,
  value,
  onChange,
}: {
  options: VariantOptions;
  value: CatalogVariant;
  onChange: (variant: CatalogVariant) => void;
}) {
  return (
    <div className="mt-4 space-y-4" data-testid="variant-picker">
      {options.colors.length > 0 ? (
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6e6e73]">
            Cor <span className="ml-1 normal-case tracking-normal text-[var(--ink)]">{value.color}</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Cor">
            {options.colors.map((color) => {
              const on = (value.color ?? "").toLowerCase() === color.toLowerCase();
              const hex = swatchHex(color, options.colorHexes[color]);
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={color}
                  title={color}
                  onClick={() => onChange(selectColor(options, value, color))}
                  className={`group flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition-all duration-200 ${
                    on
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white shadow-[0_6px_16px_rgba(17,17,17,0.18)]"
                      : "border-[#e2e2e7] bg-white text-[var(--ink)] hover:border-[#b9b9c0]"
                  }`}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 shadow-inner"
                    style={{ backgroundColor: hex }}
                    data-hex={hex}
                  >
                    {on ? (
                      <Check className={`h-3.5 w-3.5 ${isLightHex(hex) ? "text-[#1d1d1f]" : "text-white"}`} strokeWidth={3} />
                    ) : null}
                  </span>
                  {color}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {options.storages.length > 0 ? (
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6e6e73]">Armazenamento</legend>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Armazenamento">
            {options.storages.map((storage) => {
              const on = (value.storage ?? "").toLowerCase() === storage.toLowerCase();
              const available = isComboAvailable(options, value.color, storage);
              return (
                <button
                  key={storage}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!available}
                  title={available ? storage : `${storage} indisponível em ${value.color ?? "esta cor"}`}
                  onClick={() => onChange(selectStorage(options, value, storage))}
                  className={`h-11 rounded-2xl border text-sm font-semibold transition-all duration-200 ${
                    on
                      ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,white)] text-[var(--ink)] ring-1 ring-[var(--accent)]"
                      : available
                        ? "border-[#e2e2e7] bg-white text-[var(--ink)] hover:border-[#b9b9c0]"
                        : "cursor-not-allowed border-dashed border-[#e2e2e7] bg-[#f7f7f9] text-[#b0b0b6] line-through"
                  }`}
                >
                  {storage}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
