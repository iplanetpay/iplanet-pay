"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientDetailView } from "@/components/clients/client-detail-view";
import { formatCentsBRL } from "@/lib/utils";
import type { ClientArea } from "@/lib/clients/activity";
import type { ClientListItem } from "@/lib/clients/queries";
import type { Store } from "@/types/database";

function areaFor(detailBasePath: "/admin/clientes" | "/staff/clientes"): ClientArea {
  switch (detailBasePath) {
    case "/admin/clientes":
      return "admin";
    case "/staff/clientes":
      return "staff";
    default: {
      const unreachable: never = detailBasePath;
      return unreachable;
    }
  }
}

export function ClientesPanel({
  clients,
  stores: _stores,
  detailBasePath,
  initialSelectedId,
}: {
  clients: ClientListItem[];
  stores: Store[];
  detailBasePath: "/admin/clientes" | "/staff/clientes";
  initialSelectedId?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? null,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const phone = (c.phone ?? "").toLowerCase();
      return (
        c.full_name.toLowerCase().includes(q) ||
        phone.includes(q) ||
        phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      );
    });
  }, [clients, search]);

  void _stores;
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone…"
          className="h-12 w-full rounded-2xl border border-[var(--line)] bg-white pl-11 pr-4 text-sm outline-none focus:border-[var(--ink)] focus:ring-4 focus:ring-black/5"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum cliente"
          description="Ajuste a busca ou aguarde novos cadastros."
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded-2xl border bg-white px-3 py-2.5 text-left transition ${
                  selectedId === c.id
                    ? "border-[var(--accent)] ring-4 ring-[var(--accent)]/10"
                    : "border-[var(--line)] hover:border-[var(--ink)]/30"
                }`}
              >
                <p className="truncate text-sm font-bold">{c.full_name}</p>
                <p className="truncate text-xs text-[var(--ink-muted)]">
                  {c.phone ?? "Sem telefone"}
                </p>
                <p className="mt-1 text-xs">
                  {c.reservation_count} reservas · {formatCentsBRL(c.total_paid_cents)}
                </p>
              </button>
            ))}
          </div>

          <Card className="h-fit min-w-0 bg-white lg:sticky lg:top-4">
            {!selectedId ? (
              <p className="text-sm text-[var(--ink-muted)]">
                Selecione um cliente para ver os dados e as reservas.
              </p>
            ) : (
              <ClientDetailView
                clientId={selectedId}
                area={areaFor(detailBasePath)}
                fallbackName={selected?.full_name}
                fallbackPhone={selected?.phone}
                onSelectClient={setSelectedId}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
