"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { AuthDivider, GoogleAuthButton } from "@/components/auth/google-auth-button";
import {
  markShellWarm,
  routesForShell,
  shellVariantForPath,
  warmRoutes,
} from "@/lib/navigation/warm-app-shell";
import type { UserRole } from "@/types/auth";

const DEMO_ROLES: { role: UserRole; label: string }[] = [
  { role: "cliente", label: "Cliente" },
  { role: "admin", label: "Admin" },
];

export function LoginForm({
  mockMode,
  nextPath,
  productSlug,
  initialMessage,
}: {
  mockMode: boolean;
  nextPath?: string;
  productSlug?: string;
  initialMessage?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);

  function resolveRedirect(fallback: string) {
    if (nextPath) return nextPath;
    if (productSlug) return `/app/catalogo?product=${encodeURIComponent(productSlug)}`;
    return fallback;
  }

  const oauthNext = resolveRedirect("/app");

  async function submit(role?: UserRole) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role, next: nextPath }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
        warning?: string;
      };
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Não foi possível entrar.");
        setLoading(false);
        return;
      }
      if (data.warning) {
        setMessage(data.warning);
      }
      const dest = data.redirectTo ?? resolveRedirect("/app");
      const variant = shellVariantForPath(dest);
      setBooting(true);
      await warmRoutes((href) => router.prefetch(href), routesForShell(variant));
      markShellWarm(variant);
      router.push(dest);
      router.refresh();
    } catch {
      setMessage("Erro de rede. Tente novamente.");
      setLoading(false);
      setBooting(false);
    }
  }

  async function sendMagicLink() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "Solicitação enviada.");
    } catch {
      setMessage("Erro ao solicitar magic link.");
    } finally {
      setLoading(false);
    }
  }

  const signupHref = productSlug
    ? `/criar-conta?product=${encodeURIComponent(productSlug)}`
    : "/criar-conta";

  return (
    <div className="space-y-6">
      {booting ? (
        <div
          className="fixed inset-0 z-[300] flex flex-col bg-[var(--bg)]"
          aria-busy="true"
          aria-live="polite"
        >
          {/* fundo liso: o skeleton aparece já na página de destino, no lugar certo */}
          <span className="sr-only">Entrando…</span>
        </div>
      ) : null}
      {productSlug ? (
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          Depois do login você continua a reserva de{" "}
          <strong className="text-[var(--ink)]">{productSlug}</strong>.
        </p>
      ) : null}
      {mockMode ? (
        <div className="rounded-2xl bg-[var(--accent-soft)] p-4">
          <Pill tone="accent">Modo demo</Pill>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Credenciais Supabase não configuradas. Entre como um papel para
            navegar o esqueleto.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {DEMO_ROLES.map((item) => (
              <Button
                key={item.role}
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => submit(item.role)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <GoogleAuthButton nextPath={oauthNext} disabled={loading} />
          <AuthDivider />
        </>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required={!mockMode}
        />
        <Input
          label="Senha"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!mockMode}
        />
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          fullWidth
          disabled={loading || (!email && !mockMode)}
          onClick={() => void sendMagicLink()}
        >
          Enviar magic link
        </Button>
      </form>

      {message ? (
        <p className="text-sm text-[var(--ink-muted)]">{message}</p>
      ) : null}

      <p className="text-sm text-[var(--ink-muted)]">
        Ainda não tem conta?{" "}
        <Link href={signupHref} className="font-semibold text-[var(--ink)]">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
