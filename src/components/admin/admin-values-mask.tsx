"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const STORAGE_KEY = "iplanet-admin-values";
const MONEY = /R\$\s*[\d.]+,\d{2}/g;

function applyMask(root: HTMLElement, visible: boolean) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent) continue;
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

export function AdminValuesMask({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) === "1");
    setReady(true);
  }, []);

  const sync = useCallback(() => {
    const root = document.getElementById("admin-values-root");
    if (!root) return;
    applyMask(root, visible);
  }, [visible]);

  useEffect(() => {
    if (!ready) return;
    sync();
    const root = document.getElementById("admin-values-root");
    if (!root) return;
    const observer = new MutationObserver(() => sync());
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
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
      <div id="admin-values-root">{children}</div>
    </div>
  );
}
