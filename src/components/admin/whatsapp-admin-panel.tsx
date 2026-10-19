"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { WhatsappGoalNotices } from "@/components/admin/whatsapp-goal-notices";
import { WhatsappLeadSchedule } from "@/components/admin/whatsapp-lead-schedule";
import {
  formatLeadPhoneList,
  toggleAllLeads,
  toggleLeadSelection,
} from "@/lib/whatsapp/lead-selection";
import { templateLabel, templateNamePatch } from "@/lib/whatsapp/template-name";
import type { BroadcastAudience } from "@/lib/whatsapp/admin";
import type { WhatsappTemplate } from "@/types/database";

function previewBody(body: string) {
  return body
    .replace(/\{\{nome\}\}/g, "Maria")
    .replace(/\{\{produto\}\}/g, "iPhone 16")
    .replace(/\{\{valor\}\}/g, "R$ 250,00")
    .replace(/\{\{pix\}\}/g, "Pix disponível no app")
    .replace(/\{\{meta\}\}/g, "Meu iPhone")
    .replace(/\{\{reserva\}\}/g, "iPhone 16")
    .replace(/\{\{data\}\}/g, "20 de out. de 2026");
}

type Lead = { user_id: string; full_name: string; phone: string; active: boolean };

type DispatchResult = { phone: string; name: string; ok: boolean; error?: string };

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
  const [name, setName] = useState(selected ? templateLabel(selected.name) : "");
  const [body, setBody] = useState(selected?.body ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<BroadcastAudience>("clients_phone");
  const [paste, setPaste] = useState("");
  const [broadcastTpl, setBroadcastTpl] = useState(initial[0]?.id ?? "");
  const [newTplName, setNewTplName] = useState("");
  const [newTplBody, setNewTplBody] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [scheduleLead, setScheduleLead] = useState<Lead | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(() => new Set());
  const selectedPhones = useMemo(
    () =>
      formatLeadPhoneList(
        leads.filter((lead) => selectedLeads.has(lead.user_id)).map((lead) => lead.phone),
      ),
    [leads, selectedLeads],
  );
  const closeSchedule = useCallback(() => setScheduleLead(null), []);
  const [progress, setProgress] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [results, setResults] = useState<DispatchResult[]>([]);

  function pick(id: string) {
    setSelectedId(id);
    const template = templates.find((item) => item.id === id);
    setName(template ? templateLabel(template.name) : "");
    setBody(template?.body ?? "");
    setMessage(null);
    setError(null);
  }

  async function loadLeads() {
    try {
      const res = await fetch("/api/admin/whatsapp/leads");
      const data = (await res.json()) as { ok?: boolean; leads?: typeof leads };
      if (data.ok && data.leads) setLeads(data.leads);
    } catch {
      /* a próxima atualização tenta de novo */
    }
  }

  useEffect(() => {
    void loadLeads();
    const id = window.setInterval(() => void loadLeads(), 20000);
    return () => window.clearInterval(id);
  }, []);

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const renamed = templateNamePatch(selected.name, name);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, name: renamed, body }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao salvar.");
        return;
      }
      setTemplates((prev) =>
        prev.map((template) =>
          template.id === selected.id
            ? { ...template, name: renamed ?? template.name, body }
            : template,
        ),
      );
      setMessage("Template atualizado.");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function removeTemplate() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/whatsapp/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao excluir.");
        return;
      }
      const next = templates.filter((template) => template.id !== selected.id);
      setTemplates(next);
      setSelectedId(next[0]?.id ?? "");
      setName(next[0] ? templateLabel(next[0].name) : "");
      setBody(next[0]?.body ?? "");
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
        body: JSON.stringify({ name: newTplName, kind: "aviso", body: newTplBody }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
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

  async function disparar(phones?: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    setLogOpen(false);
    setProgress(8);
    const timer = window.setInterval(() => {
      setProgress((current) => (current == null ? 8 : Math.min(92, current + 7)));
    }, 400);
    try {
      const res = await fetch("/api/admin/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: broadcastTpl,
          audience: phones ? "paste" : audience,
          paste_phones: phones ?? (audience === "selected_leads" ? selectedPhones : paste),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        results?: DispatchResult[];
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha no disparo.");
        setProgress(null);
        return;
      }
      setResults(data.results ?? []);
      setProgress(100);
      setMessage("Disparo concluído com sucesso.");
    } catch {
      setError("Erro de rede.");
      setProgress(null);
    } finally {
      window.clearInterval(timer);
      setLoading(false);
    }
  }

  const failed = results.filter((item) => !item.ok);

  return (
    <div className="space-y-8">
      <p className="sr-only">{apiConfigured ? "API ligada" : "API desligada"}</p>
      {(error || message) && (
        <p className={error ? "text-sm font-medium text-[var(--danger)]" : "text-sm font-medium text-[var(--accent)]"}>
          {error ?? message}
        </p>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold tracking-tight">Templates</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => pick(template.id)}
                className={
                  template.id === selectedId
                    ? "rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)]"
                }
              >
                {templateLabel(template.name)}
              </button>
            ))}
          </div>
          {selected ? (
            <form className="mt-4 space-y-3" onSubmit={saveTemplate}>
              <Input label="Nome do Template" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea
                label="Corpo da mensagem"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-40 font-mono text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="accent" disabled={loading}>
                  {loading ? "Salvando…" : "Salvar template"}
                </Button>
                <Button type="button" variant="outline" disabled={loading} onClick={() => void removeTemplate()}>
                  Excluir
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-[var(--ink-muted)]">Nenhum template.</p>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-tight">Novo template</h2>
          <form className="mt-4 space-y-3" onSubmit={createTemplate}>
            <Input
              label="Nome do Template"
              placeholder="Boas Vindas"
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

        <Card className="lg:col-span-2">
          <h2 className="text-xl font-bold tracking-tight">Preview</h2>
          <div className="mx-auto mt-4 w-[280px] overflow-hidden rounded-[32px] border border-[#1f2c34] bg-[#0b141a] shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
            <div className="flex items-center gap-2 bg-[#1f2c34] px-3 py-3 text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6b7c85] text-xs font-bold">IP</span>
              <div>
                <p className="text-sm font-semibold">iPlanet Pay</p>
                <p className="text-[10px] text-[#8ea0aa]">online</p>
              </div>
            </div>
            <div
              className="min-h-52 bg-[#0b141a] px-3 py-4"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.03), transparent 40%)",
              }}
            >
              <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#005c4b] px-3 py-2 text-[13px] leading-snug text-[#e9edef] shadow">
                <p className="whitespace-pre-wrap">{previewBody(body || selected?.body || "…")}</p>
                <p className="mt-1 text-right text-[10px] text-[#ffffff99]">
                  {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <WhatsappGoalNotices
        templates={templates}
        onSaved={(saved) =>
          setTemplates((prev) =>
            prev.some((template) => template.id === saved.id)
              ? prev.map((template) => (template.id === saved.id ? saved : template))
              : [...prev, saved],
          )
        }
      />

      <Card>
        <h2 className="text-xl font-bold tracking-tight">Leads de disparo</h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          A lista atualiza sozinha. Clique no nome para ver a programação de disparos das metas.
        </p>
        <ul className="mt-4 max-h-64 divide-y divide-[var(--line)] overflow-y-auto text-sm">
          {leads.map((lead) => (
            <li key={lead.user_id} className="flex items-center justify-between py-2">
              <span>
                <button
                  type="button"
                  onClick={() => setScheduleLead(lead)}
                  className="font-semibold text-[var(--ink)] underline-offset-2 hover:underline"
                >
                  {lead.full_name}
                </button>{" "}
                <span className="text-[var(--ink-muted)]">{lead.phone}</span>
              </span>
              <Pill tone={lead.active ? "success" : "neutral"}>{lead.active ? "Ativo" : "Inativo"}</Pill>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-xl font-bold tracking-tight">Disparo em Massa</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Select label="Template" value={broadcastTpl} onChange={(e) => setBroadcastTpl(e.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {templateLabel(template.name)}
              </option>
            ))}
          </Select>
          <Select
            label="Audiência"
            value={audience}
            onChange={(e) => setAudience(e.target.value as BroadcastAudience)}
          >
            <option value="clients_phone">Clientes com telefone</option>
            <option value="active_goals">Usuários com metas ativas</option>
            <option value="paste">Colar lista de leads</option>
            <option value="selected_leads">Seleção de Leads</option>
          </Select>
        </div>
        {audience === "selected_leads" ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                Leads selecionados: {selectedLeads.size} de {leads.length}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={leads.length === 0}
                onClick={() =>
                  setSelectedLeads((prev) => toggleAllLeads(prev, leads.map((lead) => lead.user_id)))
                }
              >
                {leads.length > 0 && leads.every((lead) => selectedLeads.has(lead.user_id))
                  ? "Limpar seleção"
                  : "Selecionar todos"}
              </Button>
            </div>
            <ul className="max-h-64 divide-y divide-[var(--line)] overflow-y-auto rounded-lg border border-[var(--line)] text-sm">
              {leads.map((lead) => (
                <li key={lead.user_id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={selectedLeads.has(lead.user_id)}
                      onChange={() => setSelectedLeads((prev) => toggleLeadSelection(prev, lead.user_id))}
                    />
                    <span className="flex-1">{lead.full_name}</span>
                    <span className="text-[var(--ink-muted)]">{lead.phone}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div>
              <p className="text-xs font-semibold text-[var(--ink-muted)]">Números da audiência</p>
              <p className="mt-1 min-h-10 break-words rounded-lg bg-[var(--bg-subtle)] px-3 py-2 font-mono text-xs">
                {selectedPhones || "Nenhum lead selecionado."}
              </p>
            </div>
          </div>
        ) : null}
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
            disabled={loading || !broadcastTpl || (audience === "selected_leads" && !selectedPhones)}
            onClick={() => void disparar()}
          >
            Disparar
          </Button>
        </div>
        {progress != null ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-[var(--ink-muted)]">
              <span>Disparo</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
        {progress === 100 ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-[var(--accent)]">Disparo concluído com sucesso.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setLogOpen((open) => !open)}>
              Log
            </Button>
          </div>
        ) : null}
        {logOpen ? (
          <div className="mt-3 space-y-2 text-sm">
            {results.map((item) => (
              <p key={`${item.phone}-${item.name}`}>
                {item.name} · {item.phone} · {item.ok ? "recebeu" : `falhou (${item.error ?? "erro"})`}
              </p>
            ))}
            {failed.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void disparar(failed.map((item) => item.phone).join("\n"))}
              >
                Reenviar para quem falhou
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
      {scheduleLead ? <WhatsappLeadSchedule lead={scheduleLead} onClose={closeSchedule} /> : null}
    </div>
  );
}
