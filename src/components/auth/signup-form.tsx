"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthDivider, GoogleAuthButton } from "@/components/auth/google-auth-button";
import { MotionModal } from "@/components/ui/motion";
import { SignupSuccessOverlay } from "@/components/auth/signup-success";
import { trackEvent } from "@/lib/analytics/track";
import { normalizeBrazilPhone } from "@/lib/phone";
import { TERMS_OF_USE_PT, TERMS_VERSION } from "@/lib/withdrawals/types";

export function SignupForm({
  mockMode,
  initialReferralCode = "",
  productSlug,
}: {
  mockMode: boolean;
  initialReferralCode?: string;
  productSlug?: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [acceptSaqueRules, setAcceptSaqueRules] = useState(false);
  const [acceptRetiradaSorteio, setAcceptRetiradaSorteio] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const oauthNext = productSlug
    ? `/app/catalogo?product=${encodeURIComponent(productSlug)}`
    : "/app";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted || !acceptSaqueRules || !acceptRetiradaSorteio) {
      setMessage("Marque todos os aceites dos Termos de Uso para criar a conta.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: normalizeBrazilPhone(phone) ?? phone,
          cpf,
          city,
          address,
          birth_date: birthDate,
          password,
          referral_code: referralCode || undefined,
          product: productSlug,
          terms_accepted: true,
          terms_version: TERMS_VERSION,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Não foi possível criar a conta.");
        return;
      }
      void trackEvent("signup", { meta: { product: productSlug } });
      const dest = productSlug
        ? `/app/catalogo?product=${encodeURIComponent(productSlug)}`
        : (data.redirectTo ?? "/app");
      setSuccess(true);
      window.setTimeout(() => {
        router.push(dest);
        router.refresh();
      }, 2100);
    } catch {
      setMessage("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const loginHref = productSlug
    ? `/entrar?product=${encodeURIComponent(productSlug)}`
    : "/entrar";

  return (
    <div className="space-y-6">
      <SignupSuccessOverlay open={success} />
      {productSlug ? (
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          Depois de criar a conta você reserva{" "}
          <strong className="text-[var(--ink)]">{productSlug}</strong>.
        </p>
      ) : null}
      {mockMode ? (
        <p className="rounded-2xl bg-[var(--bg-lavender)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          Modo demo ativo — a conta será simulada localmente.
        </p>
      ) : (
        <>
          <GoogleAuthButton
            nextPath={oauthNext}
            label="Continuar com Google"
            disabled={loading}
          />
          <AuthDivider />
        </>
      )}

      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          label="Nome completo"
          name="full_name"
          placeholder="Seu nome"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <Input
          label="E-mail"
          type="email"
          name="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Telefone"
          name="phone"
          placeholder="(11) 99999-9999"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <Input
          label="CPF"
          name="cpf"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          required
        />
        <Input
          label="Cidade"
          name="city"
          placeholder="São Paulo"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
        />
        <Input
          label="Endereço"
          name="address"
          placeholder="Rua, número, bairro"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <Input
          label="Data de nascimento"
          name="birth_date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
        />
        <Input
          label="Código de indicação (opcional)"
          name="referral_code"
          placeholder="ABC123"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          className="uppercase tracking-widest"
        />
        <Input
          label="Senha"
          type="password"
          name="password"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!mockMode}
          minLength={mockMode ? undefined : 6}
        />

        <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span className="text-[var(--ink-muted)]">
              Li os{" "}
              <button
                type="button"
                className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
                onClick={() => setTermsOpen(true)}
              >
                Termos de Uso (platform-v2)
              </button>{" "}
              — posso abrir o pop-up agora.
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
              checked={acceptSaqueRules}
              onChange={(e) => setAcceptSaqueRules(e.target.checked)}
            />
            <span className="text-[var(--ink-muted)]">
              Aceito regras de saque: conta ativa 15 dias, mínimo R$ 1.000 em
              aportes, reembolso 70% (taxa 30%).
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
              checked={acceptRetiradaSorteio}
              onChange={(e) => setAcceptRetiradaSorteio(e.target.checked)}
            />
            <span className="text-[var(--ink-muted)]">
              Aceito retirada/envio, contrato de empréstimo a partir de 70%,
              indicação (R$ 100 do indicado) e sorteio mensal de fichas.
            </span>
          </label>
        </div>

        <Button
          type="submit"
          fullWidth
          disabled={
            loading || !termsAccepted || !acceptSaqueRules || !acceptRetiradaSorteio
          }
        >
          {loading ? "Criando..." : "Criar conta"}
        </Button>
        {message ? (
          <p className="text-sm text-[var(--ink-muted)]">{message}</p>
        ) : null}
        <p className="text-sm text-[var(--ink-muted)]">
          Já tem conta?{" "}
          <Link href={loginHref} className="font-semibold text-[var(--ink)]">
            Entrar
          </Link>
        </p>
      </form>

      <MotionModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        labelledBy="terms-title"
        className="max-w-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 id="terms-title" className="text-lg font-bold">
            Termos de Uso
          </h2>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--ink-muted)]"
            onClick={() => setTermsOpen(false)}
          >
            Fechar
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--ink-muted)]">
            {TERMS_OF_USE_PT}
          </pre>
        </div>
      </MotionModal>
    </div>
  );
}
