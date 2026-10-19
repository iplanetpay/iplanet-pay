"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, CalendarCheck, Plus, Minus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { MotionModal } from "@/components/ui/motion";
import { ClientDetailView } from "@/components/clients/client-detail-view";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ReservationStatusPill } from "@/components/reservations/status-pill";
import { CancelReservationButton } from "@/components/reservations/cancel-button";
import { ConfirmRetiradaButton } from "@/components/reservations/confirm-retirada-button";
import { ContributionList } from "@/components/wallet/contribution-list";
import { formatCentsBRL } from "@/lib/utils";
import type { Contribution } from "@/lib/wallet/types";
import { STAT_GRID_3 } from "@/lib/admin/stat-value";
import type { ClientArea } from "@/lib/clients/activity";
import {
  ALL_RESERVATION_STATUSES,
  STATUS_LABEL,
  shortReservationId,
  type ReservationOpsRow,
  type ReservationStore,
} from "@/lib/reservations/types";

function isZerada(r: ReservationOpsRow) {
  return (r.amount_paid_cents ?? 0) === 0;
}

export function OpsReservasPanel({
  reservations,
  stores,
  lockStoreId,
  showCancel = true,
  showRetirada = true,
  clientDetailArea,
}: {
  reservations: ReservationOpsRow[];
  stores: ReservationStore[];
  lockStoreId?: string | null;
  showCancel?: boolean;
  showRetirada?: boolean;
  clientDetailArea?: ClientArea;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [clientModal, setClientModal] = useState<{ id: string; name: string } | null>(null);
  const closeClientModal = useCallback(() => setClientModal(null), []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contribById, setContribById] = useState<
    Record<string, Contribution[] | "loading" | "error">
  >({});

  const status = searchParams.get("status") ?? "";

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  async function toggleAportes(reservationId: string) {
    if (expandedId === reservationId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(reservationId);
    if (contribById[reservationId] && contribById[reservationId] !== "error") {
      return;
    }
    setContribById((prev) => ({ ...prev, [reservationId]: "loading" }));
    try {
      const res = await fetch(`/api/reservations/${reservationId}/contributions`);
      const data = (await res.json()) as {
        ok?: boolean;
        contributions?: Contribution[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setContribById((prev) => ({ ...prev, [reservationId]: "error" }));
        return;
      }
      setContribById((prev) => ({
        ...prev,
        [reservationId]: data.contributions ?? [],
      }));
    } catch {
      setContribById((prev) => ({ ...prev, [reservationId]: "error" }));
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return reservations;
    return reservations.filter((r) => {
      const hay = [
        r.product?.name,
        r.client?.full_name,
        r.client?.phone,
        r.client?.email,
        r.id,
        shortReservationId(r.id),
        r.id.replace(/-/g, ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term) || hay.includes(term.replace(/-/g, ""));
    });
  }, [reservations, q]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { ativa: 0, quitada: 0, cancelada: 0, retirada: 0, trocada: 0, saque_pendente: 0, sacada: 0 };
    for (const r of reservations) {
      if (r.status in base) base[r.status as keyof typeof base] += 1;
    }
    return base;
  }, [reservations]);

  function renderAportes(r: ReservationOpsRow) {
    if (expandedId !== r.id) return null;
    const state = contribById[r.id];
    return (
      <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          Histórico de aportes
        </p>
        {state === "loading" || state == null ? (
          <p className="text-sm text-[var(--ink-muted)]">Carregando…</p>
        ) : state === "error" ? (
          <p className="text-sm text-[var(--danger)]">
            Não foi possível carregar os aportes.
          </p>
        ) : (
          <ContributionList
            contributions={state}
            emptyLabel="Nenhum aporte nesta reserva."
          />
        )}
      </div>
    );
  }

  function ClientCell({ r }: { r: ReservationOpsRow }) {
    const open = expandedId === r.id;
    const client = r.client;
    return (
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => void toggleAportes(r.id)}
          className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          aria-expanded={open}
          aria-label={open ? "Ocultar aportes" : "Ver aportes"}
          title="Ver aportes"
        >
          {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
        <div className="min-w-0">
          {clientDetailArea && client?.id ? (
            <button
              type="button"
              onClick={() => setClientModal({ id: client.id, name: client.full_name })}
              className="text-left font-medium text-[var(--ink)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
              aria-label={`Ver cliente ${client.full_name}`}
            >
              {client.full_name}
            </button>
          ) : (
            <p className="font-medium">{r.client?.full_name ?? "Cliente"}</p>
          )}
          <p className="text-xs text-[var(--ink-muted)]">
            {r.client?.phone ?? r.client?.email ?? "—"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={STAT_GRID_3}>
        {(
          [
            ["Ativas", counts.ativa, "text-[var(--accent)]"],
            ["Quitadas", counts.quitada, ""],
            ["Retiradas", counts.retirada, ""],
          ] as const
        ).map(([label, value, cls]) => (
          <StatCard
            key={label}
            label={label}
            value={String(value)}
            valueClassName={cls}
            maxRem={1.875}
          />
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar produto, cliente, telefone ou ID…"
            className="pl-10"
            aria-label="Buscar reservas"
          />
        </div>
        <Select
          label="Status"
          value={status}
          onChange={(e) => updateParam("status", e.target.value)}
        >
          <option value="">Todos</option>
          {ALL_RESERVATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        {/* Filtro de loja mantido só via lockStoreId (legado); loja não aparece na lista */}
        {!lockStoreId && stores.length === 0 ? null : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-6 w-6" />}
          title="Nenhuma reserva encontrada"
          description={
            q
              ? "Tente outro termo ou limpe a busca."
              : "Quando houver reservas, elas aparecem aqui."
          }
        />
      ) : (
        <>
          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg-subtle)] text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Produto</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Pago / Total
                  </th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3">
                        <ClientCell r={r} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate font-medium">
                          {r.product?.name ?? "Produto"}
                        </p>
                        <p className="font-mono text-[10px] text-[var(--ink-muted)]">
                          #{shortReservationId(r.id)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className="font-semibold text-[var(--accent)]">
                          {formatCentsBRL(r.amount_paid_cents)}
                        </span>
                        <span className="text-xs text-[var(--ink-muted)]">
                          {" "}
                          / {formatCentsBRL(r.list_price_cents)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ReservationStatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--ink-muted)]">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end gap-2">
                          {showCancel && r.status === "ativa" ? (
                            <CancelReservationButton
                              reservationId={r.id}
                              amountPaidCents={r.amount_paid_cents}
                              canCancel={isZerada(r)}
                            />
                          ) : null}
                          {showRetirada && r.status === "quitada" ? (
                            <ConfirmRetiradaButton
                              reservationId={r.id}
                              productName={r.product?.name}
                              size="sm"
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {expandedId === r.id ? (
                      <tr className="border-b border-[var(--line)]">
                        <td colSpan={6} className="px-4 pb-4">
                          {renderAportes(r)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-3 md:hidden">
            {filtered.map((r) => (
              <Card key={r.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ReservationStatusPill status={r.status} />
                  <span className="text-xs text-[var(--ink-muted)]">
                    #{shortReservationId(r.id)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">
                    {r.product?.name ?? "Produto"}
                  </h3>
                  <div className="mt-2">
                    <ClientCell r={r} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--ink-muted)]">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                {renderAportes(r)}
                <p className="text-sm">
                  <span className="font-semibold text-[var(--accent)]">
                    {formatCentsBRL(r.amount_paid_cents)}
                  </span>
                  <span className="text-[var(--ink-muted)]">
                    {" "}
                    / {formatCentsBRL(r.list_price_cents)}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {showCancel && r.status === "ativa" ? (
                    <CancelReservationButton
                      reservationId={r.id}
                      amountPaidCents={r.amount_paid_cents}
                      canCancel={isZerada(r)}
                    />
                  ) : null}
                  {showRetirada && r.status === "quitada" ? (
                    <ConfirmRetiradaButton
                      reservationId={r.id}
                      productName={r.product?.name}
                      size="sm"
                    />
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {clientDetailArea ? (
        <MotionModal
          open={!!clientModal}
          onClose={closeClientModal}
          labelledBy="cliente-modal-title"
          className="max-w-2xl"
        >
          {clientModal ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
                <h2 id="cliente-modal-title" className="text-lg font-bold">
                  Cliente
                </h2>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)]"
                  aria-label="Fechar"
                  onClick={closeClientModal}
                >
                  <X className="h-5 w-5" />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <ClientDetailView
                  clientId={clientModal.id}
                  area={clientDetailArea}
                  fallbackName={clientModal.name}
                  onSelectClient={(id) => setClientModal({ id, name: "Cliente" })}
                />
              </div>
            </>
          ) : null}
        </MotionModal>
      ) : null}
    </div>
  );
}
