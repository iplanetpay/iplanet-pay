"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, MapPin, Package, Search, Store, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { MotionModal } from "@/components/ui/motion";
import { Pill } from "@/components/ui/pill";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { Textarea } from "@/components/ui/textarea";
import { ClientDetailView } from "@/components/clients/client-detail-view";
import { ProductImage } from "@/components/products/product-image";
import { STAT_GRID_4 } from "@/lib/admin/stat-value";
import type { FulfillmentRow } from "@/lib/pickup/admin-queries";
import {
  filterFulfillment,
  formatFulfillmentAddress,
  fulfillmentCounts,
  fulfillmentModeLabel,
  fulfillmentStatusLabel,
  fulfillmentStatusTone,
  isOpenFulfillment,
  nextFulfillmentAction,
  shippingMethodLabel,
  type FulfillmentFilter,
  type FulfillmentMode,
  type FulfillmentStatus,
} from "@/lib/pickup/fulfillment";
import { shortReservationId } from "@/lib/reservations/types";
import { formatCentsBRL } from "@/lib/utils";
import { formatCpf } from "@/lib/profile/identity";

const FILTERS: { id: FulfillmentFilter; label: string }[] = [
  { id: "open", label: "Em aberto" },
  { id: "completed", label: "Concluídas" },
  { id: "cancelled", label: "Canceladas" },
  { id: "all", label: "Todas" },
];

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function paidPct(row: FulfillmentRow) {
  const total = row.reservation.list_price_cents;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((row.reservation.amount_paid_cents / total) * 100)));
}

function deviceSpecs(row: FulfillmentRow) {
  return [row.device.model !== row.device.name ? row.device.model : null, row.device.storage, row.device.color]
    .filter(Boolean)
    .join(" · ");
}

export function FulfillmentPanel() {
  const [rows, setRows] = useState<FulfillmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FulfillmentFilter>("open");
  const [mode, setMode] = useState<FulfillmentMode | "all">("all");
  const [storeId, setStoreId] = useState("");
  const [query, setQuery] = useState("");
  const [client, setClient] = useState<{ id: string; name: string | null; phone: string | null } | null>(null);
  const closeClient = useCallback(() => setClient(null), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pickup-requests", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; rows?: FulfillmentRow[]; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao carregar.");
        return;
      }
      setError(null);
      setRows(data.rows ?? []);
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stores = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.store.id) map.set(row.store.id, row.store.name ?? row.store.id);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const counts = useMemo(() => fulfillmentCounts(rows), [rows]);

  const visible = useMemo(
    () =>
      filterFulfillment(
        rows.map((row) => ({
          row,
          mode: row.mode,
          status: row.status,
          storeId: row.store.id,
          search: [
            row.client.full_name,
            row.client.phone,
            row.client.email,
            row.client.cpf,
            row.device.name,
            row.device.model,
            row.reservation_id,
            row.tracking_code,
          ],
        })),
        { filter, mode, storeId, query },
      ).map((item) => item.row),
    [rows, filter, mode, storeId, query],
  );

  return (
    <div className="space-y-6">
      <div className={STAT_GRID_4}>
        <StatCard label="Em aberto" value={String(counts.open)} />
        <StatCard label="Retiradas na loja" value={String(counts.store)} />
        <StatCard label="Entregas" value={String(counts.shipping)} />
        <StatCard label="Concluídas" value={String(counts.completed)} />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Situação">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                filter === item.id
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              {item.label}
              <span className="ml-2 tabular-nums opacity-70">{counts[item.id]}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cliente, telefone, CPF, aparelho, reserva ou rastreio"
              aria-label="Buscar"
              className="h-11 w-full rounded-[var(--radius-input,14px)] border border-[var(--line)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <Select
            aria-label="Retirada ou entrega"
            value={mode}
            onChange={(event) => setMode(event.target.value as FulfillmentMode | "all")}
          >
            <option value="all">Retirada e entrega</option>
            <option value="store">Retirada na loja</option>
            <option value="shipping">Entrega</option>
          </Select>
          <Select aria-label="Loja" value={storeId} onChange={(event) => setStoreId(event.target.value)}>
            <option value="">Todas as lojas</option>
            {stores.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--ink-muted)]">Carregando solicitações…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nenhuma solicitação aqui"
          description={
            rows.length === 0
              ? "Quando um cliente pedir retirada ou entrega, ela aparece nesta tela."
              : "Nenhuma solicitação combina com os filtros."
          }
        />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2" data-testid="fulfillment-list">
          {visible.map((row) => (
            <li key={row.id} className="min-w-0">
              <FulfillmentCard
                row={row}
                onOpenClient={() =>
                  setClient({ id: row.user_id, name: row.client.full_name, phone: row.client.phone })
                }
                onChanged={load}
              />
            </li>
          ))}
        </ul>
      )}

      <MotionModal open={!!client} onClose={closeClient} labelledBy="fulfillment-client-title" className="max-w-2xl">
        {client ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <h2 id="fulfillment-client-title" className="text-lg font-bold">
                Cliente
              </h2>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)]"
                aria-label="Fechar"
                onClick={closeClient}
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <ClientDetailView
                clientId={client.id}
                area="admin"
                fallbackName={client.name}
                fallbackPhone={client.phone}
                onSelectClient={(id) => setClient({ id, name: null, phone: null })}
              />
            </div>
          </>
        ) : null}
      </MotionModal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-[var(--ink)]">{children}</dd>
    </div>
  );
}

function FulfillmentCard({
  row,
  onOpenClient,
  onChanged,
}: {
  row: FulfillmentRow;
  onOpenClient: () => void;
  onChanged: () => Promise<void>;
}) {
  const [tracking, setTracking] = useState(row.tracking_code ?? "");
  const [notes, setNotes] = useState(row.admin_notes ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const next = nextFulfillmentAction(row.status, row.mode);
  const open = isOpenFulfillment(row.status);
  const address = formatFulfillmentAddress(row.address);
  const pct = paidPct(row);
  const remaining = Math.max(0, row.reservation.list_price_cents - row.reservation.amount_paid_cents);
  const prepDirty = tracking !== (row.tracking_code ?? "") || notes !== (row.admin_notes ?? "");

  async function patch(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/pickup-requests/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage({ tone: "error", text: data.error ?? "Falha ao salvar." });
        return;
      }
      setMessage({ tone: "ok", text: success });
      await onChanged();
    } catch {
      setMessage({ tone: "error", text: "Erro de rede." });
    } finally {
      setBusy(false);
    }
  }

  function move(to: FulfillmentStatus) {
    if (to === "cancelled" && !window.confirm("Cancelar esta solicitação de retirada/envio?")) return;
    void patch(
      { status: to, ...(prepDirty ? { tracking_code: tracking, admin_notes: notes } : {}) },
      fulfillmentStatusLabel(to, row.mode),
    );
  }

  function copyAddress() {
    const text = [row.client.full_name, address, row.client.phone].filter(Boolean).join("\n");
    void navigator.clipboard?.writeText(text).then(
      () => setMessage({ tone: "ok", text: "Endereço copiado." }),
      () => setMessage({ tone: "error", text: "Não foi possível copiar." }),
    );
  }

  return (
    <Card className="flex h-full flex-col gap-4" data-testid="fulfillment-card" data-status={row.status}>
      <div className="flex items-start gap-3">
        <ProductImage src={row.device.image_url} alt={row.device.name} size="sm" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={row.mode === "shipping" ? "accent" : "neutral"}>
              {row.mode === "shipping" ? <Truck className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
              {fulfillmentModeLabel(row.mode)}
            </Pill>
            <Pill tone={fulfillmentStatusTone(row.status)}>{fulfillmentStatusLabel(row.status, row.mode)}</Pill>
          </div>
          <h3 className="mt-2 truncate text-lg font-bold tracking-tight">{row.device.name}</h3>
          {deviceSpecs(row) ? <p className="text-sm text-[var(--ink-muted)]">{deviceSpecs(row)}</p> : null}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <Field label="Cliente">
          <button
            type="button"
            onClick={onOpenClient}
            className="text-left font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
          >
            {row.client.full_name ?? "Cliente"}
          </button>
          {row.client.phone ? <span className="block text-[var(--ink-muted)]">{row.client.phone}</span> : null}
          {row.client.cpf ? (
            <span className="block text-[var(--ink-muted)]">CPF {formatCpf(row.client.cpf)}</span>
          ) : null}
        </Field>
        <Field label="Loja">
          {row.store.name ?? "—"}
          {row.store.city ? <span className="block text-[var(--ink-muted)]">{row.store.city}</span> : null}
        </Field>
        <Field label="Reserva">
          #{shortReservationId(row.reservation_id)}
          <span className="block text-[var(--ink-muted)]">
            {pct}% pago · {formatCentsBRL(row.reservation.amount_paid_cents)} de{" "}
            {formatCentsBRL(row.reservation.list_price_cents)}
          </span>
        </Field>
        <Field label="Solicitado em">
          {formatDateTime(row.created_at)}
          {row.status_changed_at ? (
            <span className="block text-[var(--ink-muted)]">Status em {formatDateTime(row.status_changed_at)}</span>
          ) : null}
        </Field>
        {row.loan_contract_signed_at ? (
          <Field label="Entrega antecipada">
            Contrato de empréstimo aceito em {formatDateTime(row.loan_contract_signed_at)}
            <span className="block text-[var(--ink-muted)]">Saldo a receber {formatCentsBRL(remaining)}</span>
          </Field>
        ) : null}
        {row.mode === "shipping" ? (
          <Field label="Frete">
            {shippingMethodLabel(row.shipping_method) || "—"} ·{" "}
            {formatCentsBRL(row.freight_cents + row.insurance_cents)}
            <span className="block text-[var(--ink-muted)]">
              Frete {formatCentsBRL(row.freight_cents)} + seguro {formatCentsBRL(row.insurance_cents)} ·{" "}
              {row.freight_paid ? "pago" : "pagamento não confirmado"}
            </span>
          </Field>
        ) : null}
      </dl>

      {row.mode === "shipping" ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="flex min-w-0 items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
              <span className="break-words">{address || "Endereço não informado."}</span>
            </p>
            {address ? (
              <button
                type="button"
                onClick={copyAddress}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink-muted)] hover:text-[var(--ink)]"
                aria-label="Copiar endereço"
              >
                <Copy className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {open || row.tracking_code || row.admin_notes ? (
        <div className="grid gap-3">
          {row.mode === "shipping" ? (
            <Input
              label="Código de rastreio"
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              placeholder="Ex.: AB123456789BR"
              disabled={!open || busy}
            />
          ) : null}
          <Textarea
            label="Observações internas"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Conferência, acessórios, documento apresentado…"
            rows={2}
            disabled={!open || busy}
          />
        </div>
      ) : null}

      {message ? (
        <p className={`text-sm ${message.tone === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {message.text}
        </p>
      ) : null}

      {open ? (
        <div className="mt-auto flex flex-wrap gap-2">
          {next ? (
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={busy}
              leftIcon={<Package className="h-4 w-4" />}
              onClick={() => move(next.to)}
            >
              {next.label}
            </Button>
          ) : null}
          {prepDirty ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void patch({ tracking_code: tracking, admin_notes: notes }, "Dados salvos.")}
            >
              Salvar dados
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => move("cancelled")}>
            Cancelar
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
