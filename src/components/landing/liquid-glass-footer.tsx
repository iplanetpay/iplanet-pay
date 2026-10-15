"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";

const WA = "https://wa.me/5511973484819";
const IG = "https://www.instagram.com/iplanet_totens/";

const STORES = [
  {
    name: "Itaim Bibi",
    mapLink:
      "https://www.google.com/maps/search/?api=1&query=iPlanet+Rua+Clodomiro+Amazonas+Itaim+Bibi",
  },
  {
    name: "São Caetano",
    mapLink:
      "https://www.google.com/maps/search/?api=1&query=quiosque+iPlanet+São+Caetano+do+Sul",
  },
] as const;

function openFaqChat() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("iplanet:open-faq"));
}

const glassBtn =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white/35 text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_24px_rgba(17,17,17,0.06)] backdrop-blur-md transition hover:bg-white/55";

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

export function LiquidGlassFooter({ homeHref = null }: { homeHref?: string | null }) {
  const year = new Date().getFullYear();

  return (
    <footer className="px-3 pb-6 pt-4 md:px-6 md:pb-10">
      <div
        className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-black/[0.04] p-2.5 shadow-[0_24px_80px_rgba(17,17,17,0.08),0_2px_8px_rgba(17,17,17,0.04)] sm:rounded-[40px] md:p-4"
        style={{
          background:
            "linear-gradient(180deg, #e8e8ec 0%, #f7f7f8 45%, #ffffff 100%)",
        }}
      >
        <div
          className="rounded-[22px] border border-white/60 px-4 py-7 sm:rounded-[32px] sm:px-5 sm:py-8 md:px-10 md:py-10"
          style={{
            background:
              "linear-gradient(135deg, rgba(245,245,247,0.92) 0%, rgba(255,255,255,0.75) 48%, rgba(232,242,252,0.55) 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(17,17,17,0.04), 0 1px 2px rgba(17,17,17,0.03)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-sm">
              <a
                href={homeHref || "#hero"}
                className="inline-flex"
                aria-label={homeHref ? "Ir para o início" : "Voltar ao início"}
                onClick={(e) => {
                  if (homeHref) return;
                  e.preventDefault();
                  document.getElementById("hero")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                <BrandLogo variant="wordmark" height={44} />
              </a>
              <p className="mt-4 text-sm leading-relaxed text-[var(--ink-muted)]">
                Reserve na iPlanet, aporte via Pix no seu ritmo e retire no
                Itaim Bibi ou em São Caetano.
              </p>
            </div>

            <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-center">
              <div
                className="flex flex-1 items-center rounded-full border border-white/70 bg-white/45 px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md"
              >
                <input
                  type="email"
                  placeholder="Seu e-mail (opcional)"
                  aria-label="E-mail"
                  className="w-full bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
                  style={{ caretColor: "transparent" }}
                  readOnly
                  suppressHydrationWarning
                  onFocus={(e) => e.currentTarget.blur()}
                />
              </div>
              <a
                href={WA}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/50 px-5 py-2.5 text-sm font-semibold text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_8px_24px_rgba(17,17,17,0.06)] backdrop-blur-md transition hover:bg-white/70"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>

          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Produto
              </p>
              <ul className="mt-4 space-y-2.5 text-sm font-medium text-[var(--ink)]">
                <li>
                  <a href="#catalogo" className="hover:text-[var(--accent)]">
                    Catálogo
                  </a>
                </li>
                <li>
                  <a
                    href="#como-funciona"
                    className="hover:text-[var(--accent)]"
                  >
                    Como funciona
                  </a>
                </li>
                <li>
                  <Link href="/criar-conta" className="hover:text-[var(--accent)]">
                    Criar conta
                  </Link>
                </li>
                <li>
                  <Link href="/entrar" className="hover:text-[var(--accent)]">
                    Entrar
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Lojas
              </p>
              <ul className="mt-4 space-y-2.5 text-sm font-medium text-[var(--ink)]">
                {STORES.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--accent)]"
                    >
                      {s.name}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href={WA}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--accent)]"
                  >
                    WhatsApp
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Recursos
              </p>
              <ul className="mt-4 space-y-2.5 text-sm font-medium text-[var(--ink)]">
                <li>
                  <Link href="/ajuda" className="hover:text-[var(--accent)]">
                    Guia
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={openFaqChat}
                    className="hover:text-[var(--accent)]"
                  >
                    FAQ
                  </button>
                </li>
                <li>
                  <a
                    href={IG}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--accent)]"
                  >
                    Instagram @iplanet_totens
                  </a>
                </li>
                <li>
                  <a href="#lojas" className="hover:text-[var(--accent)]">
                    Privacidade
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-black/5 pt-6 sm:flex-row sm:items-center">
            <p className="text-sm text-[var(--ink-muted)]">
              © {year} iPlanet Pay · Itaim Bibi & São Caetano
            </p>
            <div className="flex items-center gap-2">
              <a
                href={IG}
                target="_blank"
                rel="noopener noreferrer"
                className={glassBtn}
                aria-label="Instagram"
              >
                <InstagramGlyph className="h-4 w-4" />
              </a>
              <a
                href={WA}
                target="_blank"
                rel="noopener noreferrer"
                className={glassBtn}
                aria-label="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
