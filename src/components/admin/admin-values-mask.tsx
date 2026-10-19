"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const STORAGE_KEY = "iplanet-admin-values";
const MONEY = /R\$\s*[\d.]+,\d{2}/g;
const STREAM_WAIT_MS = 10_000;
const LATE_HYDRATION_POLL_MS = 3_000;

function hasFiber(node: Node) {
  return Object.keys(node).some((key) => key.startsWith("__reactFiber$"));
}

/**
 * Streamed HTML that React has not hydrated yet must keep the server text, or hydration fails.
 * A lone text child is checked with its parent; sibling texts get their own fiber.
 */
function hydratedByReact(text: Text, parent: Element) {
  if (hasFiber(text)) return true;
  return parent.childNodes.length === 1 && hasFiber(parent);
}

function applyMask(root: HTMLElement, visible: boolean) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || !hydratedByReact(node, parent)) continue;
    const current = node.nodeValue ?? "";
    if (visible) {
      if (current.includes("••••") && parent.dataset.moneyRaw) {
        node.nodeValue = parent.dataset.moneyRaw;
      }
      continue;
    }
    if (!MONEY.test(current)) {
      MONEY.lastIndex = 0;
      continue;
    }
    MONEY.lastIndex = 0;
    if (!current.includes("••••")) parent.dataset.moneyRaw = current;
    node.nodeValue = current.replace(MONEY, "R$ ••••");
    MONEY.lastIndex = 0;
  }
}

function maskRoots(): HTMLElement[] {
  const root = document.getElementById("admin-values-root");
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
  return root ? [root, ...dialogs] : dialogs;
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Hydration can be interrupted and restarted, so text is only rewritten once the page has
 * loaded, streaming finished and the browser had idle frames to finish hydrating.
 */
async function pageSettled() {
  if (document.readyState !== "complete") {
    await new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
  }
  const started = Date.now();
  while (document.querySelector('template[id^="B:"]') && Date.now() - started < STREAM_WAIT_MS) {
    await sleep(100);
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await sleep(300);
}

export function AdminValuesMask({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const showValues = window.localStorage.getItem(STORAGE_KEY) === "1";
    setVisible(showValues);
    if (showValues) setRevealed(true);
    void pageSettled().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sync = useCallback(() => {
    for (const root of maskRoots()) applyMask(root, visible);
  }, [visible]);

  useEffect(() => {
    if (!ready) return;
    sync();
    setRevealed(true);
    // Modals render in a portal on <body>, outside the admin root, so the whole body is watched.
    const observer = new MutationObserver(() => sync());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const started = Date.now();
    const poll = window.setInterval(() => {
      sync();
      if (Date.now() - started > LATE_HYDRATION_POLL_MS) window.clearInterval(poll);
    }, 250);
    return () => {
      observer.disconnect();
      window.clearInterval(poll);
    };
  }, [ready, sync]);

  function toggle() {
    setVisible((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink)]"
          aria-pressed={visible}
        >
          {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {visible ? "Ocultar valores" : "Mostrar valores"}
        </button>
      </div>
      {/* Hidden until masked, so real values never flash while the page loads. */}
      <div id="admin-values-root" style={revealed ? undefined : { visibility: "hidden" }}>
        {children}
      </div>
    </div>
  );
}
