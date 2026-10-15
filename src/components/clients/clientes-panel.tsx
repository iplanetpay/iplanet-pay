"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { ReservationStatusPill } from "@/components/reservations/status-pill";
import { formatCentsBRL } from "@/lib/utils";
import type {
  ClientDetail,
  ClientListItem,
  ClientReservationRow,
} from "@/lib/clients/queries";
import type { Store } from "@/types/database";

const EMPTY_DETAIL: ClientDetail = {
  email: null,
  cpf: null,
  phone: null,
  city: null,
  address: null,
  birth_date: null,
  referral_code: null,
  referred_by_name: null,
  created_at: null,
  wallet_cents: 0,
};

function show(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : "—";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function progressPct(paid: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
}

export function ClientesPanel({
  clients,
  stores: _stores,
  detailBasePath,
  initialReservations,
  initialSelectedId,
}: {
  clients: ClientListItem[];
  stores: Store[];
  detailBasePath: "/admin/clientes" | "/staff/clientes";
  initialReservations?: ClientReservationRow[];
  initialSelectedId?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? null,
  );
  const [reservations, setReservations] = useState<ClientReservationRow[]>(
    initialReservations ?? [],
  );
  const [detail, setDetail] = useState<ClientDetail>(EMPTY_DETAIL);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);

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
  const reservasHref = detailBasePath.replace("/clientes", "/reservas");

  async function openDetail(client: ClientListItem) {
    setSelectedId(client.id);
    setError(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/reservations`, {
        method: "GET",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reservations?: ClientReservationRow[];
        detail?: ClientDetail;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setReservations([]);
        setDetail(EMPTY_DETAIL);
        setError(data.error ?? "Não foi possível carregar reservas.");
        return;
      }
      setReservations(data.reservations ?? []);
      setDetail(data.detail ?? EMPTY_DETAIL);
    } catch {
      setReservations([]);
      setDetail(EMPTY_DETAIL);
      setError("Erro de rede ao carregar reservas.");
    } finally {
      setLoadingDetail(false);
    }
  }

  const fields = selected
    ? [
        ["CPF", show(detail.cpf)],
        ["Telefone", show(detail.phone ?? selected.phone)],
        ["Cidade", show(detail.city)],
        ["Endereço", show(detail.address)],
        ["Data de nascimento", formatDate(detail.birth_date)],
        ["Código de indicação", show(detail.referral_code)],
        ["Indicado por", show(detail.referred_by_name)],
        ["Cadastro em", formatDate(detail.created_at ?? selected.created_at)],
      ]
    : [];

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

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

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
                onClick={() => void openDetail(c)}
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

          <Card className="h-fit bg-white lg:sticky lg:top-4">
            {!selected ? (
              <p className="text-sm text-[var(--ink-muted)]">
                Selecione um cliente para ver os dados e as reservas.
              </p>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-lg font-bold text-[var(--accent)]">
                    {selected.full_name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-xl font-bold">{selected.full_name}</h3>
                      <Pill tone="accent">Cliente</Pill>
                    </div>
                    <p className="truncate text-sm text-[var(--ink-muted)]">
                      {show(detail.email)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {fields.map(([label, value]) => (
                    <p key={label}>
                      <span className="block text-xs text-[var(--ink-muted)]">{label}</span>
                      <span className="font-medium text-[var(--ink)]">{value}</span>
                    </p>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-[var(--bg-subtle)] p-3 text-center">
                    <p className="text-xl font-bold">{selected.reservation_count}</p>
                    <p className="text-[10px] font-semibold uppercase text-[var(--ink-muted)]">
                      Reservas
                    </p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                    <p className="text-sm font-bold text-emerald-700">
                      {formatCentsBRL(selected.total_paid_cents)}
                    </p>
                    <p className="text-[10px] font-semibold uppercase text-emerald-700">
                      Total confirmado
                    </p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3 text-center">
                    <p className="text-sm font-bold text-amber-700">
                      {formatCentsBRL(detail.wallet_cents)}
                    </p>
                    <p className="text-[10px] font-semibold uppercase text-amber-700">
                      Saldo atual
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold">Reservas do cliente</h4>
                  {loadingDetail ? (
                    <p className="mt-2 text-sm text-[var(--ink-muted)]">Carregando…</p>
                  ) : reservations.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--ink-muted)]">Nenhuma reserva.</p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {reservations.map((r) => {
                        const pct = progressPct(r.amount_paid_cents, r.list_price_cents);
                        const remaining = Math.max(0, r.list_price_cents - r.amount_paid_cents);
                        const confirmed = r.contributions.filter((c) => c.status === "confirmed");
                        const last = confirmed[0];
                        const historyOpen = openHistory === r.id;
                        return (
                          <li
                            key={r.id}
                            className="rounded-2xl border border-[var(--line)] p-3"
                          >
                            <div className="flex items-start gap-3">
                              {r.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={r.image_url}
                                  alt=""
                                  className="h-12 w-12 rounded-xl border border-[var(--line)] object-contain"
                                />
                              ) : (
                                <span className="h-12 w-12 rounded-xl bg-[var(--bg-subtle)]" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold">
                                    {r.product_name ?? "Produto"}
                                  </p>
                                  <ReservationStatusPill status={r.status} />
                                </div>
                                <p className="text-xs text-[var(--ink-muted)]">
                                  Criada em {formatDate(r.created_at)}
                                </p>
                              </div>
                              <span
                                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[10px] font-bold text-[var(--accent)]"
                                style={{
                                  background: `conic-gradient(var(--accent) ${pct * 3.6}deg, #ececef 0deg)`,
                                }}
                              >
                                <span className="grid h-8 w-8 place-items-center rounded-full bg-white">
                                  {pct}%
                                </span>
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--ink-muted)]">
                              <p>Pago: {formatCentsBRL(r.amount_paid_cents)}</p>
                              <p className="text-right">
                                Total: {formatCentsBRL(r.list_price_cents)}
                              </p>
                              <p className="col-span-2">
                                Faltam {formatCentsBRL(remaining)}
                              </p>
                            </div>
                            {last ? (
                              <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                                Último depósito: {formatCentsBRL(last.amount_cents)} em{" "}
                                {formatDate(last.confirmed_at ?? last.created_at)}
                              </p>
                            ) : null}
                            <button
                              type="button"
                              className="mt-2 text-xs font-semibold text-[var(--ink)]"
                              onClick={() =>
                                setOpenHistory((current) => (current === r.id ? null : r.id))
                              }
                            >
                              Histórico ({confirmed.length}{" "}
                              {confirmed.length === 1 ? "aporte" : "aportes"})
                            </button>
                            {historyOpen ? (
                              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                                {confirmed.length === 0 ? (
                                  <li className="text-[var(--ink-muted)]">Nenhum aporte confirmado.</li>
                                ) : (
                                  confirmed.map((c) => (
                                    <li
                                      key={c.id}
                                      className="flex items-center justify-between text-emerald-700"
                                    >
                                      <span>{formatDate(c.confirmed_at ?? c.created_at)}</span>
                                      <span className="font-semibold">
                                        {formatCentsBRL(c.amount_cents)}
                                      </span>
                                    </li>
                                  ))
                                )}
                              </ul>
                            ) : null}
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Link href={reservasHref} className="block">
                                <Button type="button" variant="accent" size="sm" fullWidth>
                                  <Plus className="mr-1 h-4 w-4" /> Crédito
                                </Button>
                              </Link>
                              <Link href={reservasHref} className="block">
                                <Button type="button" variant="outline" size="sm" fullWidth>
                                  <RefreshCw className="mr-1 h-4 w-4" /> Trocar
                                </Button>
                              </Link>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
