"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { NOTICE_KIND_LABEL, unreadNoticeCount, type NoticeKind } from "@/lib/notices/copy";
import { cn } from "@/lib/utils";

type NoticeItem = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  couponCode: string | null;
  createdAt: string;
  read: boolean;
};

export function NoticeBell({ profilePending = false }: { profilePending?: boolean }) {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notices");
        const data = (await res.json()) as { ok?: boolean; notices?: NoticeItem[] };
        if (!cancelled && data.ok && data.notices) setNotices(data.notices);
      } catch {
        /* sininho fica vazio se a rede falhar */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const unread = unreadNoticeCount(
    notices,
    notices.filter((notice) => notice.read).map((notice) => notice.id),
  );
  const badge = unread + (profilePending ? 1 : 0);

  async function markRead(notice: NoticeItem) {
    if (notice.read) return;
    setNotices((current) =>
      current.map((item) => (item.id === notice.id ? { ...item, read: true } : item)),
    );
    await fetch("/api/notices/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notice_id: notice.id }),
    });
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)]"
        aria-label="Notificações"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {badge > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-xl"
        >
          <div className="border-b border-[var(--line)] px-4 py-3">
            <p className="text-sm font-bold">Notificações</p>
            <p className="text-xs text-[var(--ink-muted)]">Pendências e recados da iPlanet</p>
          </div>
          <ul className="max-h-96 space-y-1 overflow-y-auto p-2">
            {profilePending ? (
              <li>
                <Link
                  href="/app/completar-cadastro"
                  className="block rounded-2xl bg-amber-50 px-3 py-3"
                  onClick={() => setOpen(false)}
                >
                  <p className="text-xs font-semibold text-amber-700">Pendência</p>
                  <p className="text-sm font-semibold">Complete seu cadastro</p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    O aporte fica liberado depois de CPF, telefone, cidade, endereço e nascimento.
                  </p>
                </Link>
              </li>
            ) : null}
            {notices.length === 0 && !profilePending ? (
              <li className="px-3 py-8 text-center text-sm text-[var(--ink-muted)]">
                Nenhum aviso por enquanto.
              </li>
            ) : null}
            {[...notices]
              .sort((a, b) => Number(b.kind === "pendencia") - Number(a.kind === "pendencia"))
              .map((notice) => (
              <li key={notice.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-2xl px-3 py-3 text-left",
                    notice.read ? "hover:bg-[var(--bg-subtle)]" : "bg-[var(--bg-subtle)]",
                  )}
                  onClick={() => void markRead(notice)}
                >
                  <p className="text-xs font-semibold text-[var(--ink-muted)]">
                    {NOTICE_KIND_LABEL[notice.kind]}
                    {notice.read ? "" : " · novo"}
                  </p>
                  <p className="text-sm font-semibold">{notice.title}</p>
                  <p className="text-xs text-[var(--ink-muted)]">{notice.body}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
