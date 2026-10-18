"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Settings, X } from "lucide-react";

export function ClienteHeaderMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/entrar");
    router.refresh();
  }

  return (
    <div className="relative md:hidden" ref={rootRef}>
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)]"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>
      {open ? (
        <div
          id={panelId}
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-max min-w-44 overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-2 shadow-xl"
        >
          <Link
            href="/app/configuracoes"
            prefetch
            role="menuitem"
            className="flex h-11 items-center gap-2 rounded-2xl px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg-subtle)]"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4" aria-hidden />
            Configurações
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex h-11 w-full items-center rounded-2xl px-3 text-left text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg-subtle)]"
            onClick={() => void logout()}
          >
            Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}
