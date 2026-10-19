"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ExperiencePreloaderOverlay,
  type ExperiencePreloaderVariant,
} from "@/components/ui/experience-preloader";
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
 * Overlay only on the first entry into the app/admin shell.
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
  const [percent, setPercent] = useState(0);
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
        onProgress: (value) => {
          if (!cancelled) setPercent(value);
        },
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
    <>
      <ExperiencePreloaderOverlay
        variant={variant}
        active={overlay}
        percent={percent}
      />
      <div
        ref={contentRef}
        className="min-w-0 flex-1"
        inert={overlay}
        aria-hidden={overlay}
      >
        {children}
      </div>
    </>
  );
}
