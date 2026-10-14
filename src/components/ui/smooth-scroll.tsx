"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

/** Lenis só na landing — evita conflito com scroll nativo em /app e /admin. */
export function lenisEnabledForPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (
    pathname.startsWith("/app") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/entrar") ||
    pathname.startsWith("/criar-conta") ||
    pathname.startsWith("/auth")
  ) {
    return false;
  }
  return pathname === "/" || pathname.startsWith("/termos");
}

/**
 * Site-wide smooth scroll (Lenis) only on marketing pages.
 * Mount once in the root layout.
 */
export function SmoothScroll() {
  const pathname = usePathname();
  const enabled = lenisEnabledForPath(pathname);

  useEffect(() => {
    if (!enabled) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const lenis = new Lenis({
      duration: 1.35,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.1,
      prevent: (node) =>
        document.body.classList.contains("iphone-3d-modal-open") ||
        Boolean(node.closest?.("[data-lenis-prevent-touch]")) ||
        Boolean(node.closest?.('[role="dialog"]')),
    });

    let raf = 0;
    const frame = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onChange = () => {
      if (
        reduce.matches ||
        document.documentElement.dataset.landingBoot === "1"
      ) {
        lenis.stop();
      } else {
        lenis.start();
      }
    };
    onChange();
    reduce.addEventListener("change", onChange);
    window.addEventListener("iplanet:landing-boot", onChange);

    return () => {
      reduce.removeEventListener("change", onChange);
      window.removeEventListener("iplanet:landing-boot", onChange);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [enabled]);

  return null;
}
