"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
  Store,
  Trophy,
  Users,
  Gift,
  BarChart3,
  MessageCircle,
  Sparkles,
  Smartphone,
  BookOpen,
  Bell,
  X,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "./brand-logo";

const SIDEBAR_COLLAPSED_KEY = "iplanet_admin_sidebar_collapsed";
const SIDEBAR_EASE = "cubic-bezier(0.4, 0.0, 0.2, 1)";

export type SidebarIcon =
  | "layout-dashboard"
  | "package"
  | "shopping-bag"
  | "users"
  | "store"
  | "settings"
  | "trophy"
  | "credit-card"
  | "clipboard-check"
  | "bookmark"
  | "gift"
  | "bar-chart"
  | "message-circle"
  | "sparkles"
  | "smartphone"
  | "book-open"
  | "bell";

const icons: Record<SidebarIcon, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  package: Package,
  "shopping-bag": ShoppingBag,
  users: Users,
  store: Store,
  settings: Settings,
  trophy: Trophy,
  "credit-card": CreditCard,
  "clipboard-check": ClipboardCheck,
  bookmark: Bookmark,
  gift: Gift,
  "bar-chart": BarChart3,
  "message-circle": MessageCircle,
  sparkles: Sparkles,
  smartphone: Smartphone,
  "book-open": BookOpen,
  bell: Bell,
};

export interface SidebarItem {
  href: string;
  label: string;
  icon: SidebarIcon;
}

interface SidebarProps {
  title: string;
  subtitle?: string;
  items: SidebarItem[];
  footer?: React.ReactNode;
  /** Controlled mobile drawer (panel chrome) */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  /** Controlled desktop collapse (optional; defaults to localStorage) */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

/**
 * Active nav: `/admin` (Overview) is exact-only.
 * Other items match exact or prefix (`href/`).
 * Longest matching href wins when multiple match.
 */
function resolveActiveHref(
  pathname: string,
  items: SidebarItem[],
): string | null {
  let best: string | null = null;
  for (const { href } of items) {
    const exact = pathname === href;
    const prefix = pathname.startsWith(`${href}/`);
    const matches = href === "/admin" ? exact : exact || prefix;
    if (!matches) continue;
    if (!best || href.length > best.length) best = href;
  }
  return best;
}

function NavLinks({
  items,
  onNavigate,
  collapsed = false,
}: {
  items: SidebarItem[];
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const activeHref = useMemo(
    () => resolveActiveHref(pendingPath ?? pathname, items),
    [pendingPath, pathname, items],
  );

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map(({ href, label, icon }) => {
        const Icon = icons[icon];
        const active = activeHref === href;
        return (
          <Link
            key={href}
            href={href}
            prefetch
            title={collapsed ? label : undefined}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              setPendingPath(href);
              onNavigate?.();
            }}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-2xl text-sm font-semibold transition-colors duration-150 active:scale-[0.97]",
              collapsed ? "justify-center px-0 py-3" : "px-4 py-3",
              active
                ? "bg-[var(--ink)] text-white"
                : "text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed ? <span className="truncate">{label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  title,
  subtitle,
  items,
  footer,
  mobileOpen,
  onMobileOpenChange,
  collapsed: collapsedProp,
  onCollapsedChange,
}: SidebarProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = mobileOpen ?? internalOpen;
  const setOpen = onMobileOpenChange ?? setInternalOpen;
  const pathname = usePathname();

  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const collapsed = collapsedProp ?? internalCollapsed;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "1") {
        if (onCollapsedChange) onCollapsedChange(true);
        else setInternalCollapsed(true);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCollapsed = (next: boolean) => {
    if (onCollapsedChange) onCollapsedChange(next);
    else setInternalCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const collapseBtn = (
    <button
      type="button"
      onClick={() => setCollapsed(!collapsed)}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--ink-muted)] transition-colors duration-150 hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
      aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      title={collapsed ? "Expandir menu" : "Recolher menu"}
    >
      {collapsed ? (
        <PanelLeftOpen className="h-4 w-4" />
      ) : (
        <PanelLeftClose className="h-4 w-4" />
      )}
    </button>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-[var(--line)] bg-white lg:flex",
          collapsed ? "w-[4.5rem] px-2 py-6" : "w-72 p-6",
          !hydrated && "transition-none",
        )}
        style={{
          transitionProperty: "width, padding",
          transitionDuration: "220ms",
          transitionTimingFunction: SIDEBAR_EASE,
        }}
      >
        {collapsed ? (
          <div className="mb-4 flex w-full flex-col items-center gap-3">
            <Link href="/admin" aria-label="Início do admin" className="flex w-full max-w-[3.25rem] justify-center px-0.5">
              <BrandLogo variant="wordmark" height={22} priority className="w-full" />
            </Link>
            {collapseBtn}
          </div>
        ) : (
          <div className="mb-6 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href="/admin" aria-label="Início do admin" className="mb-3 inline-flex">
                  <BrandLogo variant="wordmark" height={28} priority />
                </Link>
                <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">{subtitle}</p>
                ) : null}
              </div>
              {collapseBtn}
            </div>
          </div>
        )}

        <NavLinks items={items} collapsed={collapsed} />

        {footer && !collapsed ? (
          <div className="mt-6 border-t border-[var(--line)] pt-6">{footer}</div>
        ) : null}
      </aside>

      {/* Mobile drawer — always full labels (collapse is desktop lg+) */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(100%,18rem)] flex-col overflow-y-auto border-r border-[var(--line)] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                Menu
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)]"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-[var(--ink)]">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{subtitle}</p>
              ) : null}
            </div>
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
            {footer ? (
              <div className="mt-6 border-t border-[var(--line)] pt-6">
                {footer}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function SidebarMenuButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--line)] bg-white lg:hidden"
      aria-expanded={open}
      aria-label={open ? "Fechar menu" : "Abrir menu"}
    >
      {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );
}
