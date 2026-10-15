"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Smartphone, Wallet, UserRound, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app", label: "Início", icon: Home },
  { href: "/app/catalogo", label: "Catálogo", icon: Smartphone },
  { href: "/app/carteira", label: "Carteira", icon: Wallet },
  { href: "/app/indicacoes", label: "Indicações", icon: Gift },
  { href: "/app/configuracoes", label: "Conta", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-white/95 backdrop-blur md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[min(40rem,calc(100%-2rem))] md:-translate-x-1/2 md:rounded-full md:border md:shadow-[0_12px_40px_rgba(17,17,17,0.12)]">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)] md:max-w-none md:px-3 md:pb-0">
        {items.map(({ href, label, icon: Icon }) => {
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
