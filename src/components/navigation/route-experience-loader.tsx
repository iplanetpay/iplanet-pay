"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ExperiencePreloaderVariant } from "@/components/ui/experience-preloader";
import { waitUntilPageReady } from "@/lib/navigation/wait-until-page-ready";
import {
  isShellWarm,
  markShellWarm,
  routesForShell,
  warmRoutes,
  type ShellVariant,
} from "@/lib/navigation/warm-app-shell";

function shellVariant(
  variant: ExperiencePreloaderVariant,
): ShellVariant | null {
  if (variant === "cliente" || variant === "admin") return variant;
  return null;
}

/**
 * Na primeira entrada no app/admin a própria página já renderizada vira o skeleton
 * (classe .route-skeleton: textos e imagens viram blocos que só pulsam), então
 * cada bloco já está na posição e no tamanho finais e nada pula quando o conteúdo
 * aparece. Overlay only on the first entry into the app/admin shell.
 * Later navigations stay quiet because routes were prefetched while it was up.
 */
export function RouteExperienceLoader({
  variant,
  children,
}: {
  variant: ExperiencePreloaderVariant;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState(variant !== "landing");
  const warmed = useRef(false);

  useLayoutEffect(() => {
    const shell = shellVariant(variant);
    if (shell && isShellWarm(shell)) {
      warmed.current = true;
      setOverlay(false);
    }
  }, [variant]);

  useEffect(() => {
    const shell = shellVariant(variant);
    if (shell && isShellWarm(shell)) {
      warmed.current = true;
      setOverlay(false);
      return;
    }

    if (warmed.current) {
      setOverlay(false);
      return;
    }

    let cancelled = false;
    setOverlay(true);

    void (async () => {
      const routes = shell ? routesForShell(shell) : [];
      await waitUntilPageReady(contentRef.current, {
        imageCap: 48,
        minVisibleMs: 700,
        maxReadyMs: 45_000,
        alongside: shell ? [warmRoutes((href) => router.prefetch(href), routes)] : [],
      });
      if (cancelled) return;
      if (shell) markShellWarm(shell);
      warmed.current = true;
      setOverlay(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, variant]);

  return (
    <div
      ref={contentRef}
      className={overlay ? "route-skeleton min-w-0 flex-1" : "min-w-0 flex-1"}
      data-skeleton={overlay ? "on" : undefined}
      inert={overlay}
      aria-busy={overlay || undefined}
    >
      {children}
    </div>
  );
}
