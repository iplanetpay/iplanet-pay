"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ProductWithStock } from "@/types/database";
import { storesForProduct } from "@/lib/catalog/stores-for-product";
import { trackEvent } from "@/lib/analytics/track";

interface ReserveFormProps {
  product: ProductWithStock;
}

export function ReserveForm({ product }: ReserveFormProps) {
  const router = useRouter();
  const stores = useMemo(() => storesForProduct(product), [product]);

  const [storeId, setStoreId] = useState(stores[0]?.store?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (stores.length === 0) {
    return (
      <p className="mt-5 text-sm text-[var(--ink-muted)]">
        Nenhuma loja disponível para retirada no momento.
      </p>
    );
  }

  async function submit() {
    setLoading(true);
    setMessage(null);
    try {
      void trackEvent("contribution_start", {
        product_id: product.id,
        meta: { step: "reserve" },
      });
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          store_id: storeId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
        redirectTo?: string;
      };
      if (!res.ok || !data.ok || !data.id) {
        setMessage(data.error ?? "Não foi possível reservar.");
        return;
      }
      router.push(data.redirectTo ?? `/app/reserva/${data.id}`);
      router.refresh();
    } catch {
      setMessage("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="mt-5 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {stores.length > 1 ? (
        <Select
          label="Loja para retirada"
          name="store_id"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          required
        >
          {stores.map((row) => (
            <option key={row.store!.id} value={row.store!.id}>
              {row.store!.name}
            </option>
          ))}
        </Select>
      ) : (
        <input type="hidden" name="store_id" value={storeId} />
      )}
      <Button type="submit" variant="accent" fullWidth disabled={loading || !storeId}>
        {loading ? "Reservando..." : "Reservar"}
      </Button>
      {message ? (
        <p className="text-sm text-[var(--danger)]">{message}</p>
      ) : null}
    </form>
  );
}
