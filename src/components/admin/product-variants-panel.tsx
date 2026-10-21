"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { formatCentsBRL } from "@/lib/utils";
import { Layers, Plus } from "lucide-react";
import { ColorPicker } from "@/components/admin/color-picker";
import { hexFromColorName, swatchHex } from "@/lib/catalog/colors";

type Variant = {
  id: string;
  model: string | null;
  color: string | null;
  color_hex?: string | null;
  storage: string | null;
  price_cents: number;
  active: boolean;
};

function reaisToCents(v: string): number {
  const normalized = v.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function ProductVariantsPanel({ productId }: { productId: string }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [colorHex, setColorHex] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [storage, setStorage] = useState("");
  const [priceReais, setPriceReais] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`);
      const data = (await res.json()) as {
        ok?: boolean;
        variants?: Variant[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao carregar variantes.");
        return;
      }
      setVariants(data.variants ?? []);
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addVariant(e: React.FormEvent) {
    e.preventDefault();
    const price_cents = reaisToCents(priceReais);
    if (!price_cents) {
      setError("Informe um preço válido.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model || null,
          color: color || null,
          color_hex: color ? (colorHex ?? hexFromColorName(color)) : null,
          storage: storage || null,
          price_cents,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao adicionar variante.");
        return;
      }
      setModel("");
      setColor("");
      setColorHex(null);
      setStorage("");
      setPriceReais("");
      await load();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // arrastar o seletor gera muitos valores: grava só depois de 400 ms parado
  function saveHex(variantId: string, hex: string) {
    setVariants((list) => list.map((v) => (v.id === variantId ? { ...v, color_hex: hex } : v)));
    clearTimeout(timers.current[variantId]);
    timers.current[variantId] = setTimeout(() => void persistHex(variantId, hex), 400);
  }

  async function persistHex(variantId: string, hex: string) {
    const res = await fetch(`/api/admin/products/${productId}/variants`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant_id: variantId, color_hex: hex }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }) : {};
    if (!res || !res.ok || !data.ok) setError(data.error ?? "Falha ao salvar a cor.");
  }

  return (
    <Card className="mt-6 border-dashed">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-[var(--accent)]" />
        <h3 className="text-lg font-bold tracking-tight">Variantes (SKU)</h3>
      </div>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Combinações de modelo, cor e armazenamento com preço próprio.
      </p>

      {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}

      <ul className="mt-4 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
        {variants.length === 0 ? (
          <li className="px-4 py-3 text-sm text-[var(--ink-muted)]">
            Nenhuma variante — use o formulário abaixo.
          </li>
        ) : (
          variants.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  title={v.color ? `${v.color} · ${swatchHex(v.color, v.color_hex)} (editar cor)` : "Definir cor"}
                  aria-label={`Editar cor de ${v.color ?? "variante"}`}
                  onClick={() => setEditing(editing === v.id ? null : v.id)}
                  className="h-6 w-6 rounded-full border border-black/10 shadow-inner"
                  style={{ backgroundColor: swatchHex(v.color, v.color_hex) }}
                />
                {[v.model, v.storage, v.color].filter(Boolean).join(" · ") || "—"}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatCentsBRL(v.price_cents)}</span>
                <Pill tone={v.active ? "accent" : "neutral"}>
                  {v.active ? "ativa" : "inativa"}
                </Pill>
              </div>
              {editing === v.id ? (
                <div className="w-full">
                  <ColorPicker
                    value={swatchHex(v.color, v.color_hex)}
                    onChange={(hex) => saveHex(v.id, hex)}
                  />
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={addVariant}>
        <Input label="Modelo" value={model} onChange={(e) => setModel(e.target.value)} />
        <Input label="Cor" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Titânio natural" />
        <Input
          label="Armazenamento"
          value={storage}
          onChange={(e) => setStorage(e.target.value)}
          placeholder="256 GB"
        />
        <Input
          label="Preço (R$)"
          value={priceReais}
          onChange={(e) => setPriceReais(e.target.value)}
          placeholder="8999,00"
          required
        />
        <div className="sm:col-span-2">
          <ColorPicker
            value={colorHex ?? hexFromColorName(color)}
            onChange={setColorHex}
            onPickFavorite={(name) => setColor((c) => c || name)}
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={loading}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Adicionar variante
          </Button>
        </div>
      </form>
    </Card>
  );
}
