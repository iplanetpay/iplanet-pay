"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Gift } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { ReservationStatusPill } from "@/components/reservations/status-pill";
import { formatCentsBRL } from "@/lib/utils";
import {
  EMPTY_ACTIVITY,
  clientActivityHref,
  clientTotals,
  formatDateBR as formatDate,
  tradeInTone,
  withdrawalTone,
  type ClientActivity,
  type ClientArea,
} from "@/lib/clients/activity";
import { REFERRAL_STATUS_LABEL } from "@/lib/referrals/types";
import { USED_DEVICE_STATUS_LABEL } from "@/lib/trade-in/constants";
import { WITHDRAWAL_STATUS_LABEL } from "@/lib/withdrawals/types";
import type { ClientDetail, ClientReservationRow } from "@/lib/clients/queries";

const EMPTY_DETAIL: ClientDetail = {
  id: null,
  full_name: null,
  email: null,
  cpf: null,
  phone: null,
  city: null,
  state: null,
  address: null,
  address_number: null,
  birth_date: null,
  referral_code: null,
  referred_by_id: null,
  referred_by_name: null,
  created_at: null,
  wallet_cents: 0,
};

function formatAddress(detail: ClientDetail) {
  const street = [detail.address, detail.address_number].filter(Boolean).join(", ");
  const cityState = [detail.city, detail.state].filter(Boolean).join(" · ");
  if (street && cityState) return `${street} · ${cityState}`;
  return street || cityState || null;
}

function show(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : "—";
}

function progressPct(paid: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
}

function ActivityRow({ href, children }: { href: string | null; children: ReactNode }) {
  const className =
    "flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-3 py-2.5 text-left text-sm";
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link
      href={href}
      prefetch={false}
      className={`${className} transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40`}
    >
      {children}
    </Link>
  );
}

export function ClientDetailView({
  clientId,
  area,
  fallbackName,
  fallbackPhone,
  onSelectClient,
}: {
  clientId: string;
  area: ClientArea;
  fallbackName?: string | null;
  fallbackPhone?: string | null;
  onSelectClient: (id: string) => void;
}) {
  const [reservations, setReservations] = useState<ClientReservationRow[]>([]);
  const [detail, setDetail] = useState<ClientDetail>(EMPTY_DETAIL);
  const [activity, setActivity] = useState<ClientActivity>(EMPTY_ACTIVITY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [referralsOpen, setReferralsOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    setOpenHistory(null);
    setReferralsOpen(false);
    setReservations([]);
    setDetail(EMPTY_DETAIL);
    setActivity(EMPTY_ACTIVITY);
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/reservations`);
        const data = (await res.json()) as {
          ok?: boolean;
          reservations?: ClientReservationRow[];
          detail?: ClientDetail;
          activity?: ClientActivity;
          error?: string;
        };
        if (ignore) return;
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Não foi possível carregar o cliente.");
          return;
        }
        setReservations(data.reservations ?? []);
        setDetail(data.detail ?? EMPTY_DETAIL);
        setActivity(data.activity ?? EMPTY_ACTIVITY);
      } catch {
        if (!ignore) setError("Erro de rede ao carregar o cliente.");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [clientId]);

  const name = detail.full_name ?? fallbackName ?? "Cliente";
  const totals = clientTotals(reservations);
  const fields: Array<[string, string]> = [
    ["CPF", show(detail.cpf)],
    ["Telefone", show(detail.phone ?? fallbackPhone)],
    ["Cidade", show(detail.city)],
    ["Estado", show(detail.state)],
    ["Endereço", show(formatAddress(detail))],
    ["Data de nascimento", formatDate(detail.birth_date)],
    ["Cadastro em", formatDate(detail.created_at)],
  ];

  return (
    <div className="@container min-w-0 space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-lg font-bold text-[var(--accent)]">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-xl font-bold">{name}</h3>
            <Pill tone="accent">Cliente</Pill>
          </div>
          <p className="truncate text-sm text-[var(--ink-muted)]">{show(detail.email)}</p>
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm @xs:grid-cols-2">
        {fields.map(([label, value]) => (
          <p key={label} className="min-w-0 [overflow-wrap:anywhere]">
            <span className="block text-xs text-[var(--ink-muted)]">{label}</span>
            <span className="font-medium text-[var(--ink)]">{value}</span>
          </p>
        ))}
        <div className="min-w-0">
          <span className="block text-xs text-[var(--ink-muted)]">Indicado por</span>
          {detail.referred_by_id ? (
            <button
              type="button"
              className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              onClick={() => onSelectClient(detail.referred_by_id as string)}
            >
              {show(detail.referred_by_name)}
            </button>
          ) : (
            <span className="font-medium text-[var(--ink)]">{show(detail.referred_by_name)}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 @sm:grid-cols-3">
        <div className="min-w-0 rounded-2xl bg-[var(--bg-subtle)] p-3 text-center">
          <p className="text-xl font-bold">{totals.reservation_count}</p>
          <p className="text-[10px] font-semibold uppercase text-[var(--ink-muted)]">Reservas</p>
        </div>
        <div className="min-w-0 rounded-2xl bg-emerald-50 p-3 text-center">
          <p className="text-sm font-bold text-emerald-700 [overflow-wrap:anywhere]">
            {formatCentsBRL(totals.total_paid_cents)}
          </p>
          <p className="text-[10px] font-semibold uppercase text-emerald-700">Total confirmado</p>
        </div>
        <div className="min-w-0 rounded-2xl bg-amber-50 p-3 text-center">
          <p className="text-sm font-bold text-amber-700 [overflow-wrap:anywhere]">
            {formatCentsBRL(detail.wallet_cents)}
          </p>
          <p className="text-[10px] font-semibold uppercase text-amber-700">Saldo atual</p>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--line)] p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          <Gift className="h-4 w-4" /> Indicação
        </div>
        {detail.referral_code ? (
          <button
            type="button"
            aria-expanded={referralsOpen}
            onClick={() => setReferralsOpen((open) => !open)}
            className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-left"
          >
            <span className="min-w-0">
              <span className="block font-mono text-base font-bold tracking-wider [overflow-wrap:anywhere]">
                {detail.referral_code}
              </span>
              <span className="text-xs text-[var(--ink-muted)]">
                {loading
                  ? "Carregando indicados…"
                  : `${activity.referred.length} ${
                      activity.referred.length === 1 ? "cliente indicado" : "clientes indicados"
                    }`}
              </span>
            </span>
            {referralsOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
          </button>
        ) : (
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            {loading ? "Carregando…" : "Sem código de indicação."}
          </p>
        )}
        {referralsOpen ? (
          activity.referred.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--ink-muted)]">Ninguém usou este código ainda.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {activity.referred.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelectClient(r.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--bg-subtle)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[var(--accent)]">
                        {r.full_name}
                      </span>
                      <span className="text-xs text-[var(--ink-muted)]">
                        Desde {formatDate(r.created_at)}
                      </span>
                    </span>
                    {r.status ? (
                      <Pill tone={r.status === "completed" ? "success" : "lavender"} className="shrink-0">
                        {REFERRAL_STATUS_LABEL[r.status]}
                      </Pill>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {activity.trade_ins.length > 0 ? (
        <section>
          <h4 className="font-bold">Avaliação de usados</h4>
          <ul className="mt-2 space-y-2">
            {activity.trade_ins.map((o) => (
              <li key={o.id}>
                <ActivityRow href={clientActivityHref(area, "trade_in", o.id)}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{o.device_model}</span>
                    <span className="text-xs text-[var(--ink-muted)]">
                      {formatDate(o.created_at)} ·{" "}
                      {formatCentsBRL(o.approved_value_cents ?? o.expected_value_cents)}
                    </span>
                  </span>
                  <Pill tone={tradeInTone(o.status)} className="shrink-0">
                    {USED_DEVICE_STATUS_LABEL[o.status]}
                  </Pill>
                </ActivityRow>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activity.withdrawals.length > 0 ? (
        <section>
          <h4 className="font-bold">Análise de saque</h4>
          <ul className="mt-2 space-y-2">
            {activity.withdrawals.map((w) => (
              <li key={w.id}>
                <ActivityRow href={clientActivityHref(area, "withdrawal", w.id)}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {w.product_name ?? "Reserva"}
                    </span>
                    <span className="text-xs text-[var(--ink-muted)]">
                      {formatDate(w.created_at)} · reembolso {formatCentsBRL(w.refund_amount_cents)}
                    </span>
                  </span>
                  <Pill tone={withdrawalTone(w.status)} className="shrink-0">
                    {WITHDRAWAL_STATUS_LABEL[w.status]}
                  </Pill>
                </ActivityRow>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div>
        <h4 className="font-bold">Reservas do cliente</h4>
        {loading ? (
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
                <li key={r.id} className="rounded-2xl border border-[var(--line)] p-3">
                  <div className="flex items-start gap-3">
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl border border-[var(--line)] object-contain"
                      />
                    ) : (
                      <span className="h-12 w-12 shrink-0 rounded-xl bg-[var(--bg-subtle)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-semibold">{r.product_name ?? "Produto"}</p>
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
                    <p className="text-right">Total: {formatCentsBRL(r.list_price_cents)}</p>
                    <p className="col-span-2">Faltam {formatCentsBRL(remaining)}</p>
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
                    onClick={() => setOpenHistory((current) => (current === r.id ? null : r.id))}
                  >
                    Histórico ({confirmed.length} {confirmed.length === 1 ? "aporte" : "aportes"})
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
                            <span className="font-semibold">{formatCentsBRL(c.amount_cents)}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
