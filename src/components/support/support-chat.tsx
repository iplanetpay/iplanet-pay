"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Send, Sparkles, X } from "lucide-react";
import { MarkdownView } from "@/components/support/markdown-view";
import { drainSupportEvents } from "@/lib/support-ai/client-stream";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  handoff?: boolean;
  error?: boolean;
}

export const OPEN_SUPPORT_EVENT = "iplanet:open-support";
const STORAGE_KEY = "iplanet:support-chat";
const GREETING: Msg = {
  role: "assistant",
  content: "Olá! Sou a assistente do iPlanet Pay. Posso ajudar com reservas, Pix, metas, Wallet e indicações. Como posso ajudar?",
};

export function openSupportChat() {
  window.dispatchEvent(new Event(OPEN_SUPPORT_EVENT));
}

export function SupportChat({ whatsappDigits }: { whatsappDigits?: string | null }) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [busy, setBusy] = useState(false);
  const [waFromServer, setWaFromServer] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Msg[];
        if (Array.isArray(parsed) && parsed.length) setMsgs(parsed);
      }
    } catch {
      // ignore
    }
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_SUPPORT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SUPPORT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-40)));
    } catch {
      // ignore
    }
  }, [msgs, mounted]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [msgs, busy, open, reduce]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const waLink = useMemo(() => {
    const digits = (waFromServer ?? whatsappDigits ?? "").replace(/\D/g, "");
    if (!digits) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent("Olá! Preciso de ajuda com o iPlanet Pay.")}`;
  }, [whatsappDigits, waFromServer]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const history: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const payload = history
      .filter((m) => m !== GREETING && !m.error && m.content)
      .map(({ role, content }) => ({ role, content }));

    const patchLast = (fn: (m: Msg) => Msg) =>
      setMsgs((cur) => {
        const next = cur.slice();
        next[next.length - 1] = fn(next[next.length - 1]);
        return next;
      });

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload, stream: true }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; handoff?: boolean; whatsapp?: string | null };
        if (data.whatsapp) setWaFromServer(data.whatsapp);
        patchLast(() => ({
          role: "assistant",
          content: data.error ?? "Não consegui responder agora. Tente de novo.",
          handoff: data.handoff ?? res.status >= 500,
          error: true,
        }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = drainSupportEvents(buffer);
        buffer = rest;
        for (const ev of events) {
          if (ev.type === "delta") patchLast((m) => ({ ...m, content: m.content + ev.text }));
          if (ev.type === "error") patchLast((m) => ({ ...m, content: m.content || ev.error, error: !m.content }));
        }
      }
      patchLast((m) =>
        m.content ? { ...m, handoff: /whatsapp|atendente|atendimento humano/i.test(m.content) } : { ...m, content: "Sem resposta. Tente de novo.", error: true },
      );
    } catch {
      if (!controller.signal.aborted) {
        patchLast(() => ({ role: "assistant", content: "Erro de rede. Tente de novo.", error: true }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [busy, input, msgs]);

  function reset() {
    abortRef.current?.abort();
    setMsgs([GREETING]);
    setBusy(false);
  }

  if (!mounted) return null;
  const typing = busy && msgs[msgs.length - 1]?.content === "";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="support"
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Suporte iPlanet"
            className="flex h-[min(85dvh,640px)] w-full flex-col overflow-hidden rounded-t-[28px] border border-[var(--line)] bg-white shadow-2xl sm:max-w-md sm:rounded-[28px]"
            initial={reduce ? false : { y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <div className="flex items-center gap-3 bg-[var(--ink)] px-4 py-3 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Suporte iPlanet</p>
                <p className="text-xs text-white/70">Assistente com IA · WhatsApp se precisar</p>
              </div>
              <button type="button" onClick={reset} className="rounded-full px-2 py-1 text-xs text-white/70 hover:bg-white/10">
                Nova conversa
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
                aria-label="Fechar suporte"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto bg-[var(--bg-subtle)]/40 px-3 py-3" aria-live="polite">
              {msgs.map((m, i) =>
                m.role === "assistant" && m.content === "" ? null : (
                  <motion.div
                    key={i}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      m.role === "user"
                        ? "ml-auto bg-[var(--accent)] text-white"
                        : m.error
                          ? "bg-white text-[var(--danger)] shadow-sm"
                          : "bg-white text-[var(--ink)] shadow-sm",
                    )}
                  >
                    {m.role === "assistant" ? <MarkdownView source={m.content} /> : m.content}
                    {m.handoff && waLink ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex rounded-full bg-[var(--whatsapp)] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Falar no WhatsApp
                      </a>
                    ) : null}
                  </motion.div>
                ),
              )}
              {typing ? (
                <div className="flex w-14 items-center justify-center gap-1 rounded-2xl bg-white px-3 py-3 shadow-sm" aria-label="Digitando">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-[var(--ink-muted)]"
                      animate={reduce ? undefined : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <form
              className="flex gap-2 border-t border-[var(--line)] bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={2000}
                placeholder="Digite sua dúvida…"
                className="flex-1 rounded-full border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-2 text-sm outline-none focus:border-[var(--accent)]"
                autoFocus
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-white disabled:opacity-40"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
