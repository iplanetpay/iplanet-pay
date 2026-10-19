"use client";

import { useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { LogoutButton } from "@/components/auth/logout-button";
import { Pill } from "@/components/ui/pill";
import { AdminValuesMask } from "@/components/admin/admin-values-mask";
import { HomeLogo } from "@/components/ui/home-logo";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { SidebarItem } from "@/components/ui/sidebar";

const ADMIN_NAV: SidebarItem[] = [
  { href: "/admin", label: "Overview", icon: "layout-dashboard" },
  { href: "/admin/dashboards", label: "Dashboards", icon: "bar-chart" },
  { href: "/admin/reservas", label: "Reservas", icon: "bookmark" },
  { href: "/admin/retirada-envio", label: "Retirada/Envio", icon: "truck" },
  { href: "/admin/avaliacao-usados", label: "Avaliação de usados", icon: "smartphone" },
  { href: "/admin/clientes", label: "Clientes", icon: "users" },
  { href: "/admin/produtos", label: "Produtos", icon: "package" },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: "message-circle" },
  { href: "/admin/financeiro", label: "Financeiro", icon: "credit-card" },
  { href: "/admin/sorteio", label: "Sorteio", icon: "sparkles" },
  { href: "/admin/avisos", label: "Avisos", icon: "bell" },
  { href: "/admin/config", label: "Config", icon: "settings" },
  { href: "/admin/indicacoes", label: "Indicações", icon: "gift" },
  { href: "/admin/ajuda", label: "Guia", icon: "book-open" },
];

/**
 * Client wrapper so mobile drawer state works.
 * Auth gate lives in AdminPanelChrome (server).
 */
export function PanelChromeClient({
  title,
  subtitle,
  userName,
  userRole,
  children,
}: {
  title: string;
  subtitle: string;
  userName: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <AppShell
      variant="painel"
      sidebarTitle={title}
      sidebarSubtitle={subtitle}
      sidebarItems={ADMIN_NAV}
      mobileMenuOpen={menuOpen}
      onMobileMenuOpenChange={setMenuOpen}
      sidebarFooter={
        <div className="space-y-3">
          <p className="text-sm font-semibold">{userName}</p>
          <Pill tone="accent">{userRole}</Pill>
          <LogoutButton />
        </div>
      }
      topBar={
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <SidebarMenuButton
              open={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            />
            <HomeLogo href="/admin" height={28} className="shrink-0 lg:hidden" />
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-base font-bold sm:text-lg">{title}</p>
            </div>
          </div>
          <div className="shrink-0">
            <LogoutButton />
          </div>
        </div>
      }
    >
      <AdminValuesMask>{children}</AdminValuesMask>
    </AppShell>
  );
}
