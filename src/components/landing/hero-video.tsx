"use client";

import { useEffect, useRef } from "react";

/**
 * Safari only autoplays a video that is muted, inline and visible, and keeps
 * it paused when it starts hidden (streamed Suspense HTML, boot overlay) or in
 * Low Power Mode. Retry play() whenever one of those conditions clears.
 */
export function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    let inView = true;

    const tryPlay = () => {
      if (!inView || document.hidden || !video.paused) return;
      video.play().catch(() => {});
    };

    const onGesture = () => tryPlay();
    const removeGestureListeners = () => {
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("scroll", onGesture);
    };
    const onPlaying = () => removeGestureListeners();
    const onVisibility = () => {
      if (document.hidden) video.pause();
      else tryPlay();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        if (inView) tryPlay();
        else video.pause();
      },
      { threshold: 0.01 },
    );
    observer.observe(video);

    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("playing", onPlaying);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("iplanet:landing-boot", tryPlay);
    window.addEventListener("touchstart", onGesture, { passive: true });
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("scroll", onGesture, { passive: true });

    tryPlay();

    return () => {
      observer.disconnect();
      removeGestureListeners();
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("playing", onPlaying);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("iplanet:landing-boot", tryPlay);
    };
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      autoPlay
      muted
      loop
      playsInline
      poster="/videos/iphone-18-pro-hero-poster.jpg"
      preload="auto"
      data-boot-optional=""
      aria-hidden
    >
      <source
        src="/videos/iphone-18-pro-hero-mobile.mp4"
        type="video/mp4"
        media="(max-width: 767px)"
      />
      <source src="/videos/iphone-18-pro-hero.mp4" type="video/mp4" />
    </video>
  );
}
