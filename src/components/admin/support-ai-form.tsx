"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MarkdownView } from "@/components/support/markdown-view";
import { readJson } from "@/lib/http/read-json";
import { SUPPORT_PROVIDERS, type SupportProvider } from "@/lib/support-ai/core";
import { cn } from "@/lib/utils";

export interface SupportAiInitial {
  available: boolean;
  enabled: boolean;
  provider: SupportProvider;
  baseUrl: string;
  model: string;
  behaviorMd: string;
  apiKeySet: boolean;
  apiKeyLast4: string | null;
}

export function SupportAiSettingsForm({ initial }: { initial: SupportAiInitial }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [provider, setProvider] = useState<SupportProvider>(initial.provider);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.model);
  const [md, setMd] = useState(initial.behaviorMd);
  const [apiKey, setApiKey] = useState("");
  const [keySet, setKeySet] = useState(initial.apiKeySet);
  const [last4, setLast4] = useState(initial.apiKeyLast4);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function onProvider(next: SupportProvider) {
    setProvider(next);
    if (next !== "custom") {
      setBaseUrl(SUPPORT_PROVIDERS[next].baseUrl);
      setModel(SUPPORT_PROVIDERS[next].model);
    }
  }

  async function save(clearKey = false) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/support-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          provider,
          base_url: baseUrl,
          model,
          behavior_md: md,
          api_key: clearKey ? undefined : apiKey || undefined,
          clear_api_key: clearKey || undefined,
        }),
      });
      const data = await readJson<{ ok?: boolean; error?: string; api_key_set?: boolean; api_key_last4?: string | null }>(res);
      if (!data.ok) {
        setError(data.error ?? "Falha ao salvar.");
        return;
      }
      setApiKey("");
      setKeySet(Boolean(data.api_key_set));
      setLast4(data.api_key_last4 ?? null);
      setMessage("Salvo.");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Suporte com IA</h3>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Chat de suporte do cliente (site e app). A chave fica só no servidor.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--accent)]"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Ativado
        </label>
      </div>

      {!initial.available ? (
        <p className="mt-3 rounded-2xl bg-[var(--bg-subtle)] p-3 text-sm text-[var(--danger)]">
          Tabela de configuração não encontrada. Aplique a migração 035_support_ai.sql.
        </p>
      ) : null}

      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Select label="Provedor" value={provider} onChange={(e) => onProvider(e.target.value as SupportProvider)}>
            {(Object.keys(SUPPORT_PROVIDERS) as SupportProvider[]).map((p) => (
              <option key={p} value={p}>
                {SUPPORT_PROVIDERS[p].label}
              </option>
            ))}
          </Select>
          <Input label="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
          <Input label="Modelo" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
        </div>

        <div className="space-y-2">
          <Input
            label="API Key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keySet ? `Salva ${last4 ? `••••${last4}` : "••••"} — digite para trocar` : "Cole a chave do provedor"}
            hint="Somente escrita: depois de salva, aparecem só os 4 últimos caracteres."
          />
          {keySet ? (
            <button
              type="button"
              className="text-xs font-semibold text-[var(--danger)] underline"
              onClick={() => void save(true)}
              disabled={loading}
            >
              Remover chave salva
            </button>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Comportamento da IA (Markdown)</span>
            <div className="flex rounded-full bg-[var(--bg-subtle)] p-1 text-xs font-semibold">
              {(["edit", "preview"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn("rounded-full px-3 py-1", tab === t ? "bg-white shadow" : "text-[var(--ink-muted)]")}
                >
                  {t === "edit" ? "Editar" : "Prévia"}
                </button>
              ))}
            </div>
          </div>
          {tab === "edit" ? (
            <textarea
              value={md}
              onChange={(e) => setMd(e.target.value)}
              spellCheck={false}
              className="h-[28rem] w-full rounded-2xl border border-[var(--line)] bg-white p-4 font-mono text-xs leading-relaxed outline-none focus:border-[var(--ink)]"
            />
          ) : (
            <div className="h-[28rem] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-4">
              <MarkdownView source={md} />
            </div>
          )}
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{md.length.toLocaleString("pt-BR")} / 60.000 caracteres</p>
        </div>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
        <Button type="submit" variant="accent" disabled={loading}>
          {loading ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </Card>
  );
}
