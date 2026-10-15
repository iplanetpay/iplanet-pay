"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Pill } from "@/components/ui/pill";
import type { WhatsappTemplate } from "@/types/database";

function previewBody(body: string) {
  return body
    .replace(/\{\{nome\}\}/g, "Maria")
    .replace(/\{\{produto\}\}/g, "iPhone 16")
    .replace(/\{\{valor\}\}/g, "R$ 250,00")
    .replace(/\{\{pix\}\}/g, "QR estará disponível quando Pix estiver configurado")
    .replace(/\{\{meta\}\}/g, "Meu iPhone");
}

export function WhatsappAdminPanel({
  templates: initial,
  apiConfigured,
}: {
  templates: WhatsappTemplate[];
  apiConfigured: boolean;
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? "");
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );
  const [body, setBody] = useState(selected?.body ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<
    "clients_phone" | "active_goals" | "paste"
  >("clients_phone");
  const [paste, setPaste] = useState("");
  const [broadcastTpl, setBroadcastTpl] = useState(initial[0]?.id ?? "");
  const [newTplName, setNewTplName] = useState("");
  const [newTplBody, setNewTplBody] = useState("");
  const [leads, setLeads] = useState<
    Array<{
      user_id: string;
      full_name: string;
      phone: string;
      active: boolean;
    }>
  >([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);

  function pick(id: string) {
    setSelectedId(id);
    const t = templates.find((x) => x.id === id);
    setBody(t?.body ?? "");
    setMessage(null);
    setError(null);
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, body }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao salvar.");
        return;
      }
      setTemplates((prev) =>
        prev.map((t) => (t.id === selected.id ? { ...t, body } : t)),
      );
      setMessage("Template atualizado.");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTplName,
          kind: "aviso",
          body: newTplBody,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; id?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao criar.");
        return;
      }
      setMessage("Template criado.");
      setNewTplName("");
      setNewTplBody("");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function loadLeads() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp/leads");
      const data = (await res.json()) as {
        ok?: boolean;
        leads?: typeof leads;
        error?: string;
      };
      if (data.ok && data.leads) {
        setLeads(data.leads);
        setLeadsLoaded(true);
      } else {
        setError(data.error ?? "Falha ao carregar leads.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function disparar() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: broadcastTpl,
          audience,
          paste_phones: paste,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        enqueued?: number;
        api_configured?: boolean;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha no disparo.");
        return;
      }
      setMessage(
        `Enfileiradas ${data.enqueued ?? 0} mensagens` +
          (data.api_configured
            ? " (Evolution)."
            : " (sem Evolution; só fila)."),
      );
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--ink-muted)]">
            Status da API WhatsApp
          </p>
          <p className="mt-1 text-lg font-bold">
            API configurada?{" "}
            <span className={apiConfigured ? "text-[var(--success)]" : ""}>
              {apiConfigured ? "sim" : "não"}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.
            Sem essas variáveis, as mensagens ficam só na fila.
          </p>
        </div>
        <Pill tone={apiConfigured ? "accent" : "neutral"}>
          {apiConfigured ? "Evolution pronta" : "Só fila"}
        </Pill>
      </Card>

      {(error || message) && (
        <p
          className={
            error
              ? "text-sm font-medium text-[var(--danger)]"
              : "text-sm font-medium text-[var(--accent)]"
          }
        >
          {error ?? message}
        </p>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold tracking-tight">Templates</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Placeholders: {"{{nome}}"} {"{{produto}}"} {"{{valor}}"} {"{{pix}}"}{" "}
            {"{{meta}}"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t.id)}
                className={
                  t.id === selectedId
                    ? "rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)]"
                }
              >
                {t.name}
              </button>
            ))}
          </div>
          {selected ? (
            <form className="mt-4 space-y-3" onSubmit={saveTemplate}>
              <p className="text-sm">
                <Pill tone="lavender">{selected.kind}</Pill>{" "}
                <span className="text-[var(--ink-muted)]">/{selected.name}</span>
              </p>
              <Textarea
                label="Corpo da mensagem"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-40 font-mono text-sm"
              />
              <Button type="submit" variant="accent" disabled={loading}>
                {loading ? "Salvando…" : "Salvar template"}
              </Button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-[var(--ink-muted)]">
              Nenhum template.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-tight">Novo template</h2>
          <form className="mt-4 space-y-3" onSubmit={createTemplate}>
            <input
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              placeholder="nome_do_template"
              value={newTplName}
              onChange={(e) => setNewTplName(e.target.value)}
              required
            />
            <Textarea
              label="Corpo"
              value={newTplBody}
              onChange={(e) => setNewTplBody(e.target.value)}
              className="min-h-28 font-mono text-sm"
            />
            <Button type="submit" variant="outline" disabled={loading}>
              Adicionar template
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-tight">Preview</h2>
          <div className="mt-4 whitespace-pre-wrap rounded-[20px] border border-[var(--line)] bg-[var(--bg-subtle)] p-4 text-sm leading-relaxed">
            {previewBody(body || selected?.body || "…")}
          </div>
        </Card>
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight">Leads de disparo</h2>
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadLeads()}>
            {leadsLoaded ? "Atualizar" : "Carregar leads"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Inativo = sem movimentação há mais de 45 dias.
        </p>
        {leadsLoaded ? (
          <ul className="mt-4 max-h-64 divide-y divide-[var(--line)] overflow-y-auto text-sm">
            {leads.map((l) => (
              <li key={l.user_id} className="flex items-center justify-between py-2">
                <span>
                  {l.full_name}{" "}
                  <span className="text-[var(--ink-muted)]">{l.phone}</span>
                </span>
                <Pill tone={l.active ? "success" : "neutral"}>
                  {l.active ? "Ativo" : "Inativo"}
                </Pill>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-xl font-bold tracking-tight">Broadcast</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Disparar grava em whatsapp_dispatch_queue e envia pela Evolution
          quando ela está configurada.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Select
            label="Template"
            value={broadcastTpl}
            onChange={(e) => setBroadcastTpl(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.kind})
              </option>
            ))}
          </Select>
          <Select
            label="Audiência"
            value={audience}
            onChange={(e) =>
              setAudience(
                e.target.value as "clients_phone" | "active_goals" | "paste",
              )
            }
          >
            <option value="clients_phone">Clientes com telefone</option>
            <option value="active_goals">Usuários com metas ativas</option>
            <option value="paste">Colar lista de leads</option>
          </Select>
        </div>
        {audience === "paste" ? (
          <div className="mt-3">
            <Textarea
              label="Telefones (um por linha ou separados por vírgula)"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="5511999999999"
            />
          </div>
        ) : null}
        <div className="mt-4">
          <Button
            type="button"
            variant="accent"
            disabled={loading || !broadcastTpl}
            onClick={() => void disparar()}
          >
            Disparar
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold tracking-tight">Configuração</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--ink-muted)]">
          <li>EVOLUTION_API_URL — endereço da Evolution, sem barra no final</li>
          <li>EVOLUTION_API_KEY — header apikey</li>
          <li>EVOLUTION_INSTANCE — nome da instância conectada</li>
          <li>whatsapp_support (já em Config) — WhatsApp da loja no FAQ</li>
          <li>
            Cron: GET/POST /api/cron/whatsapp-goals com Bearer CRON_SECRET
          </li>
        </ul>
        <p className="mt-4 text-sm text-[var(--ink-muted)]">
          Após o primeiro aporte confirmado por reserva, o sistema enfileira o
          template <strong>primeiro_aporte</strong> e agenda lembrete se houver
          meta com reminder_day (1–30) + reminder_at.
        </p>
      </Card>
    </div>
  );
}
