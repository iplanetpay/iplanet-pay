"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/ui/pill";
import { MotionModal } from "@/components/ui/motion";
import { formatCentsBRL } from "@/lib/utils";
import { USED_DEVICE_STATUS_LABEL } from "@/lib/trade-in/constants";
import { tradeInDecisionValue } from "@/lib/trade-in/offer-state";
import type { UsedDeviceOfferWithProfile } from "@/lib/trade-in/types";
import { maintenanceLabels } from "@/components/trade-in/used-device-offer-status";

const STATUS_TONE: Record<string, "lavender" | "success" | "danger"> = {
  pending: "lavender",
  approved: "success",
  rejected: "danger",
};

export function AdminUsedDevicePanel() {
  const router = useRouter();
  const [rows, setRows] = useState<UsedDeviceOfferWithProfile[]>([]);
  const [status, setStatus] = useState("all");
  const [name, setName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<UsedDeviceOfferWithProfile | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<"approve" | "reject" | "counter" | null>(null);
  const [siblings, setSiblings] = useState<UsedDeviceOfferWithProfile[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [approvedBrl, setApprovedBrl] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (name.trim()) params.set("name", name.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      const res = await fetch(`/api/admin/trade-in?${params.toString()}`);
      const data = (await res.json()) as {
        ok?: boolean;
        rows?: UsedDeviceOfferWithProfile[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao carregar.");
        return;
      }
      setRows(data.rows ?? []);
    } catch {
      setError("Erro de rede.");
    }
  }, [status, name, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(row: UsedDeviceOfferWithProfile) {
    setActive(row);
    setSiblings(
      rows.filter(
        (item) => item.reservation_id === row.reservation_id && item.id !== row.id,
      ),
    );
    try {
      const res = await fetch("/api/admin/trade-in?status=all");
      const data = (await res.json()) as { ok?: boolean; rows?: UsedDeviceOfferWithProfile[] };
      if (data.ok && data.rows) {
        setSiblings(
          data.rows.filter(
            (item) => item.reservation_id === row.reservation_id && item.id !== row.id,
          ),
        );
      }
    } catch {
      /* a lista já carregada cobre o ciclo visível */
    }
    setDecision(null);
    setAdminMessage("");
    setApprovedBrl("");
    setPhotoUrls({});
    if (row.photo_paths.length === 0) return;
    try {
      const res = await fetch("/api/trade-in/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: row.id, paths: row.photo_paths }),
      });
      const data = (await res.json()) as { ok?: boolean; urls?: Record<string, string> };
      if (data.ok && data.urls) setPhotoUrls(data.urls);
    } catch {
      /* ignore */
    }
  }

  async function submitReview() {
    if (!active || !decision) return;
    if ((decision === "reject" || decision === "counter") && !adminMessage.trim()) {
      setError(decision === "counter" ? "A mensagem da contra-proposta é obrigatória." : "Informe o motivo da recusa.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let proposedCents: number | null = null;
      if (decision === "counter") {
        const raw = approvedBrl.trim();
        const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
        const n = Number(normalized);
        if (!Number.isFinite(n) || n <= 0) {
          setError("Informe o valor da contra-proposta.");
          setLoading(false);
          return;
        }
        proposedCents = Math.round(n * 100);
      }
      const approvedValueCents = tradeInDecisionValue(
        decision,
        active.expected_value_cents,
        proposedCents,
      );

      const res = await fetch("/api/admin/trade-in/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: active.id,
          action: decision,
          adminMessage: adminMessage.trim(),
          approvedValueCents,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao avaliar.");
        return;
      }
      setActive(null);
      setDecision(null);
      await load();
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Nome do cliente" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Todos</option>
          <option value="pending">Pendente de avaliação</option>
          <option value="approved">Aprovado</option>
          <option value="rejected">Recusado</option>
        </Select>
        <Input
          label="Data inicial"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          label="Data final"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="button" variant="outline" onClick={() => void load()}>
            Aplicar filtros
          </Button>
        </div>
      </Card>

      {error && !active ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <Card className="overflow-x-auto p-0">
        <ul className="divide-y divide-[var(--line)]">
          {rows.length === 0 ? (
            <li className="px-4 py-8 text-sm text-[var(--ink-muted)]">
              Nenhuma solicitação encontrada.
            </li>
          ) : (
            rows.map((r) => (
              <li key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left hover:opacity-90"
                    onClick={() => void openDetail(r)}
                  >
                    <p className="font-semibold text-[var(--ink)]">
                      {r.client_name ?? "Cliente"}
                    </p>
                    <p className="text-sm text-[var(--ink-muted)]">
                      {r.device_model} · {new Date(r.created_at).toLocaleString("pt-BR")}
                    </p>
                  </button>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Pill tone={STATUS_TONE[r.status] ?? "lavender"}>
                      {USED_DEVICE_STATUS_LABEL[r.status]}
                    </Pill>
                    {r.status === "pending" ? (
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        onClick={() => void openDetail(r)}
                      >
                        Avaliar aparelho
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void openDetail(r)}
                      >
                        Ver detalhes
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>

      <MotionModal
        open={!!active}
        onClose={() => setActive(null)}
        labelledBy="avaliar-usado-title"
        className="max-w-3xl"
      >
        {active ? (
          <div className="flex max-h-[92dvh] flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                  Avaliação
                </p>
                <h2 id="avaliar-usado-title" className="text-xl font-bold text-[var(--ink)]">
                  Avaliar aparelho do cliente
                </h2>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)]"
                aria-label="Fechar"
                onClick={() => setActive(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-[var(--ink-muted)]">Cliente</p>
                  <p className="font-semibold text-[var(--ink)]">{active.client_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[var(--ink-muted)]">Modelo oferecido</p>
                  <p className="font-semibold text-[var(--ink)]">{active.device_model}</p>
                </div>
                <div>
                  <p className="text-[var(--ink-muted)]">IMEI</p>
                  <p className="font-mono text-[var(--ink)]">{active.imei}</p>
                </div>
                <div>
                  <p className="text-[var(--ink-muted)]">Valor desejado</p>
                  <p className="font-semibold text-[var(--accent)]">
                    {formatCentsBRL(active.expected_value_cents)}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Mínimo aceito: {formatCentsBRL(active.minimum_value_cents)}
                  </p>
                </div>
              </div>

              <Card className="space-y-2 bg-[var(--bg-subtle)] text-sm">
                <p className="text-[var(--ink)]">
                  <span className="font-medium text-[var(--ink-muted)]">Manutenções: </span>
                  {maintenanceLabels(active.maintenance_options)}
                </p>
                <p className="text-[var(--ink)]">
                  <span className="font-medium text-[var(--ink-muted)]">Exposição a líquidos: </span>
                  {active.liquid_exposure ? "Sim" : "Não"}
                </p>
              </Card>

              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--ink)]">Fotos anexadas</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {active.photo_paths.map((path) => (
                    <div
                      key={path}
                      className="aspect-square overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-subtle)]"
                    >
                      {photoUrls[path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoUrls[path]}
                          alt="Foto do aparelho"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[var(--ink-muted)]">
                          Carregando…
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {siblings.length > 0 ? (
                <Card className="space-y-2 text-sm">
                  <p className="font-semibold text-[var(--ink)]">
                    Reavaliação · outras avaliações deste aparelho
                  </p>
                  {siblings.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full rounded-xl border border-[var(--line)] px-3 py-2 text-left"
                      onClick={() => void openDetail(item)}
                    >
                      {new Date(item.created_at).toLocaleDateString("pt-BR")} · {item.status} ·{" "}
                      {formatCentsBRL(item.expected_value_cents)} · {item.photo_paths.length} fotos
                    </button>
                  ))}
                </Card>
              ) : null}

              {active.status === "pending" && !(active.reviewed_at && active.approved_value_cents) ? (
                <Card className="space-y-3">
                  <p className="text-sm font-semibold text-[var(--ink)]">Decisão</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={decision === "approve" ? "accent" : "outline"}
                      onClick={() => setDecision("approve")}
                    >
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant={decision === "reject" ? "accent" : "outline"}
                      onClick={() => setDecision("reject")}
                    >
                      Recusar
                    </Button>
                    <Button
                      type="button"
                      variant={decision === "counter" ? "accent" : "outline"}
                      onClick={() => {
                        setDecision("counter");
                        setApprovedBrl("");
                      }}
                    >
                      Contra-proposta
                    </Button>
                  </div>
                  {decision === "approve" ? (
                    <p className="text-sm text-[var(--ink)]">
                      Valor aprovado:{" "}
                      <span className="font-semibold">
                        {formatCentsBRL(active.expected_value_cents)}
                      </span>
                      . É o valor informado pelo cliente.
                    </p>
                  ) : null}
                  {decision === "counter" ? (
                    <Input
                      label="Valor proposto (R$)"
                      value={approvedBrl}
                      onChange={(e) => setApprovedBrl(e.target.value)}
                      placeholder="0,00"
                    />
                  ) : null}
                  <Textarea
                    label={
                      decision === "reject" || decision === "counter"
                        ? "Mensagem (obrigatória)"
                        : "Mensagem (opcional)"
                    }
                    value={adminMessage}
                    onChange={(e) => setAdminMessage(e.target.value)}
                    rows={4}
                  />
                  {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
                  <Button
                    type="button"
                    variant="accent"
                    disabled={!decision || loading}
                    onClick={() => void submitReview()}
                  >
                    {loading ? "Salvando…" : "Confirmar avaliação"}
                  </Button>
                </Card>
              ) : (
                <Card
                  className={
                    active.status === "rejected"
                      ? "border-red-200 bg-red-50"
                      : "border-[var(--accent)]/30 bg-[var(--accent-soft)]"
                  }
                >
                  <p className="font-semibold text-[var(--ink)]">
                    {active.status === "rejected"
                      ? "Avaliação recusada"
                      : active.status === "pending"
                        ? "Contra-proposta enviada"
                        : "Avaliação aprovada"}
                  </p>
                  {active.approved_value_cents ? (
                    <p className="mt-1 text-sm text-[var(--ink-muted)]">
                      Valor creditado: {formatCentsBRL(active.approved_value_cents)}
                    </p>
                  ) : null}
                  {active.admin_message ? (
                    <p className="mt-2 text-sm text-[var(--ink)]">
                      <span className="font-semibold">Mensagem: </span>
                      {active.admin_message}
                    </p>
                  ) : null}
                </Card>
              )}
            </div>
          </div>
        ) : null}
      </MotionModal>
    </section>
  );
}
