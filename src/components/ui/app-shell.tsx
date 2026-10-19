import type { ReactNode } from "react";
import { RoutePrefetcher } from "@/components/navigation/route-prefetcher";
import {
  ADMIN_PREFETCH_ROUTES,
  CLIENTE_PREFETCH_ROUTES,
} from "@/lib/navigation/prefetch-routes";
import { LegalFooter } from "./legal-footer";
import { Sidebar, type SidebarItem } from "./sidebar";
import { BottomNav } from "./bottom-nav";

interface AppShellProps {
  children: ReactNode;
  variant?: "cliente" | "painel";
  sidebarTitle?: string;
  sidebarSubtitle?: string;
  sidebarItems?: SidebarItem[];
  sidebarFooter?: ReactNode;
  topBar?: ReactNode;
  mobileMenuOpen?: boolean;
  onMobileMenuOpenChange?: (open: boolean) => void;
}

export function AppShell({
  children,
  variant = "cliente",
  sidebarTitle,
  sidebarSubtitle,
  sidebarItems = [],
  sidebarFooter,
  topBar,
  mobileMenuOpen,
  onMobileMenuOpenChange,
}: AppShellProps) {
  if (variant === "cliente") {
    return (
      <div className="min-h-screen overflow-x-hidden bg-[var(--bg)]">
        <RoutePrefetcher routes={CLIENTE_PREFETCH_ROUTES} />
        <div className="mx-auto max-w-5xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-28">
          {topBar}
          {children}
        </div>
        <LegalFooter />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[var(--bg-subtle)]">
      <RoutePrefetcher routes={ADMIN_PREFETCH_ROUTES} />
      <Sidebar
        title={sidebarTitle ?? "Painel"}
        subtitle={sidebarSubtitle}
        items={sidebarItems}
        footer={sidebarFooter}
        mobileOpen={mobileMenuOpen}
        onMobileOpenChange={onMobileMenuOpenChange}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {topBar ? (
          <div className="border-b border-[var(--line)] bg-white px-4 py-4 md:px-8">
            {topBar}
          </div>
        ) : null}
        <main className="min-w-0 flex-1 overflow-x-auto px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
