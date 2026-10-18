"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Smartphone, Wallet, UserRound, Gift, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLIENTE_DOCK, type ClienteDockHref } from "@/lib/navigation/cliente-dock";

export function BottomNav() {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-white/95 backdrop-blur md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[min(46rem,calc(100%-2rem))] md:-translate-x-1/2 md:rounded-full md:border md:shadow-[0_12px_40px_rgba(17,17,17,0.12)]">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)] md:max-w-none md:px-3 md:pb-0">
        {CLIENTE_DOCK.map(({ href, label }) => {
          const Icon = dockIcon(href);
          const active =
            pendingPath === href ||
            (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch
                onClick={() => setPendingPath(href)}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight sm:text-[11px]",
                  active ? "text-[var(--accent)]" : "text-[var(--ink-muted)]",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.4 : 2} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function dockIcon(href: ClienteDockHref) {
  switch (href) {
    case "/app":
      return Home;
    case "/app/catalogo":
      return Smartphone;
    case "/app/carteira":
      return Wallet;
    case "/app/metas":
      return Mountain;
    case "/app/indicacoes":
      return Gift;
    case "/app/configuracoes":
      return UserRound;
    default: {
      const _exhaustive: never = href;
      return _exhaustive;
    }
  }
}
