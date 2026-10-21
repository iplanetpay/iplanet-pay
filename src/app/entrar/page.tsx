import Link from "next/link";
import { TERMS_VERSION } from "@/lib/withdrawals/types";
import { LoginForm } from "@/components/auth/login-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { HomeLogo } from "@/components/ui/home-logo";
import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { ReferralLoginTeaser } from "@/components/auth/referral-login-teaser";

export const metadata = { title: "Entrar" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams?: Promise<{ product?: string; next?: string; error?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const product = sp.product;
  const authError = sp.error?.trim() || null;
  const next = product
    ? `/app/catalogo?product=${encodeURIComponent(product)}`
    : sp.next;

  return (
    <div className="min-h-screen bg-[var(--bg-subtle)] px-4 py-10 md:px-8">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex justify-center">
          <HomeLogo href="/" height={52} />
        </div>
        <PageHeader
          eyebrow="Acesso"
          title="Entrar"
          description="Continue sua reserva ou gerencie a loja."
          size="md"
          showBack
          backForceHref="/"
        />
        <Card className="mt-8">
          <LoginForm
            mockMode={USE_MOCK_AUTH}
            nextPath={next}
            productSlug={product}
            initialMessage={
              authError === "sem_permissao_admin"
                ? "Sua conta entrou, mas não tem papel admin. Use o botão Admin no modo demo ou peça para alterar profiles.role no Supabase."
                : authError
            }
          />
        </Card>
        <ReferralLoginTeaser />
        <p className="mt-4 text-center text-sm text-[var(--ink-muted)]">
          Ainda não tem conta?{" "}
          <Link
            href={product ? `/criar-conta?product=${encodeURIComponent(product)}` : "/criar-conta"}
            className="font-semibold text-[var(--ink)]"
          >
            Criar conta
          </Link>
        </p>
        <p className="mt-6 text-center text-xs text-[var(--ink-muted)]">
          <Link href="/termos" className="underline">
            Termos de uso
          </Link>{" "}
          · saque, retirada, indicação e sorteio ({TERMS_VERSION})
        </p>
      </div>
    </div>
  );
}
