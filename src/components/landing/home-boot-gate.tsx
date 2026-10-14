"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExperiencePreloader } from "@/components/ui/experience-preloader";
import { waitUntilPageReady } from "@/lib/navigation/wait-until-page-ready";

/** Keep the overlay up until landing media, Fold models and the 3D stage are ready. */
function landingStillLoading(root: HTMLElement) {
  const video = root.querySelector<HTMLVideoElement>("#hero video");
  if (!video) return true;
  if (!video.error && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
    return true;
  }
  for (const img of root.querySelectorAll("img")) {
    if (!img.getAttribute("src") && !img.currentSrc) continue;
    if (!img.complete) return true;
  }
  const steps = root.querySelectorAll("[data-duo-step]");
  if (steps.length < 3) return true;
  if (root.querySelector('[aria-label="Carregando iPhone Duo"]')) return true;
  if (root.querySelector('[aria-label="Loading iPhone Duo"]')) return true;
  if (root.querySelector(".iphone-duo-loading-mark")) return true;
  for (const step of steps) {
    if (!step.querySelector("canvas")) return true;
  }
  const stage = root.querySelector("#experiencia-3d");
  if (!stage?.querySelector("canvas")) return true;
  if (stage.textContent?.includes("Carregando modelo")) return true;
  return false;
}

/**
 * Overlay visível no HTML. Só solta em 100%, depois do download da mídia pesada.
 */
export function HomeBootGate({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showBoot, setShowBoot] = useState(true);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.dataset.landingBoot = "1";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    window.dispatchEvent(new Event("iplanet:landing-boot"));

    const release = () => {
      delete html.dataset.landingBoot;
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      window.dispatchEvent(new Event("iplanet:landing-boot"));
    };

    let cancelled = false;

    void (async () => {
      await waitUntilPageReady(contentRef.current, {
        minVisibleMs: 700,
        maxReadyMs: 45_000,
        watchMedia: true,
        isPending: landingStillLoading,
        onProgress: (value) => {
          if (!cancelled) setPercent(value);
        },
      });
      if (!cancelled) {
        setPercent(100);
        setShowBoot(false);
        release();
      }
    })();

    return () => {
      cancelled = true;
      release();
    };
  }, []);

  return (
    <>
      {showBoot ? (
        <div
          className="experience-preloader-overlay fixed inset-0 z-[200] flex h-dvh flex-col overflow-hidden overscroll-none bg-[var(--bg)]"
          aria-busy="true"
          aria-live="polite"
        >
          <ExperiencePreloader
            variant="landing"
            className="h-dvh"
            percent={percent}
          />
        </div>
      ) : null}
      <div
        ref={contentRef}
        inert={showBoot}
        aria-hidden={showBoot}
        className={showBoot ? "pointer-events-none select-none" : undefined}
      >
        {children}
      </div>
    </>
  );
}
