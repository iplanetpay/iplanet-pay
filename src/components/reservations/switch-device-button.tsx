"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCentsBRL } from "@/lib/utils";
import type { ProductWithStock } from "@/types/database";

export function SwitchDeviceButton({
  reservationId,
  currentProductId,
  storeId,
  amountPaidCents,
  products,
}: {
  reservationId: string;
  currentProductId: string;
  storeId: string;
  amountPaidCents: number;
  products: ProductWithStock[];
  // storeId kept for callers; switch RPC uses reservation store
}) {
  const router = useRouter();
  void storeId; // reserved for future store-scoped filters
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const options = useMemo(() => {
    return products.filter((p) => {
      if (!p.active || p.id === currentProductId) return false;
      // Infinite stock: any other active product is eligible (same-store switch in RPC)
      return true;
    });
  }, [products, currentProductId]);

  const selected = options.find((p) => p.id === selectedId) ?? null;

  async function confirm() {
    if (!selectedId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: selectedId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.id) {
        setMessage(data.error ?? "Não foi possível trocar o aparelho.");
        return;
      }
      setOpen(false);
      router.push(`/app/reserva/${data.id}`);
      router.refresh();
    } catch {
      setMessage("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        leftIcon={<RefreshCw className="h-4 w-4" />}
        onClick={() => {
          setOpen(true);
          setMessage(null);
          setSelectedId(null);
        }}
      >
        Trocar aparelho
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-black/40"
            onClick={() => !loading && setOpen(false)}
          />
          <div className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-[var(--radius-card)] border border-[var(--line)] bg-white shadow-xl sm:rounded-[var(--radius-card)]">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Trocar aparelho
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  Seu saldo de{" "}
                  <strong className="text-[var(--ink)]">
                    {formatCentsBRL(amountPaidCents)}
                  </strong>{" "}
                  será transferido para o novo produto na mesma loja.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)]"
                onClick={() => !loading && setOpen(false)}
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {options.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
                  Nenhum outro aparelho disponível para troca.
                </p>
              ) : (
                options.map((p) => {
                  const active = selectedId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={`flex w-full items-center gap-3 rounded-[var(--radius-card)] border px-3 py-3 text-left transition ${
                        active
                          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
                          : "border-[var(--line)] hover:bg-[var(--bg-subtle)]"
                      }`}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-subtle)]">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-[var(--ink-muted)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {[p.storage, p.color].filter(Boolean).join(" · ")}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-[var(--accent)]">
                          {formatCentsBRL(p.list_price_cents)}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="space-y-2 border-t border-[var(--line)] px-5 py-4">
              {selected ? (
                <p className="text-xs text-[var(--ink-muted)]">
                  {amountPaidCents >= selected.list_price_cents
                    ? "Com o saldo atual a nova reserva ficará quitada."
                    : `Restará ${formatCentsBRL(Math.max(0, selected.list_price_cents - amountPaidCents))} para quitar.`}
                </p>
              ) : null}
              <Button
                type="button"
                variant="accent"
                fullWidth
                disabled={!selectedId || loading || options.length === 0}
                onClick={() => void confirm()}
              >
                {loading ? "Trocando..." : "Confirmar troca"}
              </Button>
              {message ? (
                <p className="text-sm text-[var(--danger)]">{message}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
