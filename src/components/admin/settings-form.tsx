"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCentsBRL } from "@/lib/utils";
import Link from "next/link";

async function saveSetting(key: string, value: string) {
  const res = await fetch("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  return (await res.json()) as { ok?: boolean; error?: string };
}

export function ReferralSettingsForm({
  initialBonusCents,
}: {
  initialBonusCents: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialBonusCents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const preview = Number(value);
  const previewLabel =
    Number.isFinite(preview) && preview >= 0 ? formatCentsBRL(preview) : "—";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await saveSetting("referral_bonus_amount_cents", value);
      if (!data.ok) {
        setError(data.error ?? "Falha ao salvar.");
        return;
      }
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
      <h3 className="text-lg font-bold tracking-tight">Bônus de indicação</h3>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Valor em centavos creditado ao indicador (ex.: 5000 = R$ 50,00).
      </p>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <Input
          label="referral_bonus_amount_cents"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          hint={`Prévia: ${previewLabel}`}
          required
        />
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
        <Button type="submit" variant="accent" disabled={loading}>
          {loading ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </Card>
  );
}

export function MilestoneWhatsappSettingsForm({
  initialAdminE164,
}: {
  initialAdminE164: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialAdminE164);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await saveSetting(
        "admin_whatsapp_e164",
        value.replace(/\D/g, ""),
      );
      if (!data.ok) {
        setError(data.error ?? "Falha ao salvar.");
        return;
      }
      setMessage("Salvo — alertas 50% e 70% serão enfileirados neste número.");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-bold tracking-tight">Alertas de aporte (50% / 70%)</h3>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        WhatsApp do administrador que recebe aviso quando o cliente atinge marcos do aporte.
      </p>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <Input
          label="admin_whatsapp_e164"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="5511999999999"
        />
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
        <Button type="submit" variant="accent" disabled={loading}>
          {loading ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </Card>
  );
}

export function SupportAndAgentSettingsForm({
  initialWhatsapp,
  initialWhatsappAdmin,
  initialAgentEnabled,
  whatsappAdminConfigured,
}: {
  initialWhatsapp: string;
  initialWhatsappAdmin: string;
  initialAgentEnabled: boolean;
  whatsappAdminConfigured: boolean;
}) {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp);
  const [whatsappAdmin, setWhatsappAdmin] = useState(initialWhatsappAdmin);
  const [agentEnabled, setAgentEnabled] = useState(initialAgentEnabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const a = await saveSetting(
        "whatsapp_support",
        whatsapp.replace(/\D/g, ""),
      );
      const b = await saveSetting(
        "whatsapp_admin",
        whatsappAdmin.replace(/\D/g, ""),
      );
      const c = await saveSetting(
        "agent_enabled",
        agentEnabled ? "true" : "false",
      );
      if (!a.ok || !b.ok || !c.ok) {
        setError(a.error ?? b.error ?? c.error ?? "Falha ao salvar.");
        return;
      }
      setMessage("Salvo.");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-bold tracking-tight">Suporte & Agente</h3>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          WhatsApp para handoff do FAQ e canal do agente com o admin do sistema
          (sem Telegram).
        </p>
      </div>
      <form className="space-y-3" onSubmit={onSubmit}>
        <Input
          label="WhatsApp suporte (E.164, só dígitos)"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="5511999999999"
          hint="Usado em wa.me/&lt;digits&gt; no chat FAQ"
        />
        <Input
          label="WhatsApp admin (agente AI)"
          value={whatsappAdmin}
          onChange={(e) => setWhatsappAdmin(e.target.value)}
          placeholder="5511999999999"
          hint="Número do admin do sistema para o agente falar via WhatsApp"
        />
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={agentEnabled}
            onChange={(e) => setAgentEnabled(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          agent_enabled
        </label>
        <p className="text-sm text-[var(--ink-muted)]">
          whatsapp_admin_channel:{" "}
          <strong>
            {whatsappAdminConfigured
              ? "configurado (número e/ou Evolution)"
              : "não"}
          </strong>
        </p>
        <p className="rounded-2xl bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          Conecte EVOLUTION_API_* / AGENT_API_KEY / Resend quando o produto estiver
          100%. Telegram foi removido — o agente usa WhatsApp com o admin.
          Rotas respondem 503 com mensagem clara até as chaves existirem.
        </p>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="accent" disabled={loading}>
            {loading ? "Salvando…" : "Salvar"}
          </Button>
          <Link href="/admin/emails/preview">
            <Button type="button" variant="outline">
              Preview e-mails
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
