"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards: both sides render the same first HTML. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn("experience-skeleton overflow-hidden rounded-full", className)}
      aria-hidden
    />
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("experience-skeleton overflow-hidden rounded-2xl", className)}
      aria-hidden
    />
  );
}

function ClientePageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-6 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <SkeletonBar className="h-10 w-36 rounded-xl" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 w-10 rounded-full" />
          <SkeletonBlock className="h-10 w-10 rounded-full" />
        </div>
      </div>
      <SkeletonBar className="h-11 w-full max-w-md" />
      <SkeletonBar className="h-6 max-w-sm w-[66%]" />
      <SkeletonBlock className="h-52 w-full sm:h-60" />
      <SkeletonBar className="h-7 w-40" />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonBlock className="h-40 w-full" />
        <SkeletonBlock className="h-40 w-full" />
      </div>
    </div>
  );
}

function LandingPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-4 md:px-8 md:pt-8">
      <div className="flex items-center justify-between gap-4">
        <SkeletonBar className="h-9 w-32 rounded-xl" />
        <div className="flex gap-2">
          <SkeletonBar className="h-10 w-24 rounded-full" />
          <SkeletonBar className="h-10 w-28 rounded-full" />
        </div>
      </div>
      <SkeletonBlock className="h-[min(52vh,420px)] w-full rounded-[28px]" />
      <div className="space-y-3">
        <SkeletonBar className="h-8 w-56" />
        <SkeletonBar className="h-5 w-full max-w-xl" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBar key={i} className="h-9 w-20 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}

function AdminPageSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-0 lg:gap-6">
      <div className="hidden w-16 shrink-0 flex-col gap-3 px-2 py-6 lg:flex">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="mx-auto h-10 w-10 rounded-2xl" />
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-5 px-4 py-6 md:px-8">
        <SkeletonBar className="h-10 w-48" />
        <SkeletonBar className="h-6 w-72 max-w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-28 w-full" />
          ))}
        </div>
        <SkeletonBlock className="h-36 w-full" />
        <SkeletonBlock className="h-48 w-full" />
      </div>
    </div>
  );
}

function LoadingSpinner({ percent }: { percent?: number }) {
  const known = typeof percent === "number";
  const value = known ? Math.max(0, Math.min(100, Math.round(percent))) : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-[260] flex flex-col items-center justify-center gap-3">
      <div
        className="experience-spinner h-12 w-12 rounded-full border-[3px] border-[var(--line)] border-t-[var(--accent)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={
          value != null
            ? `Carregando experiência ${value}%`
            : "Carregando experiência"
        }
      />
      {value != null ? (
        <span
          className="text-sm font-semibold tabular-nums text-[var(--ink-muted)]"
          data-preloader-percent
          aria-hidden
        >
          {value}%
        </span>
      ) : null}
    </div>
  );
}

export type ExperiencePreloaderVariant = "cliente" | "admin" | "landing";

function PageSkeleton({ variant }: { variant: ExperiencePreloaderVariant }) {
  if (variant === "admin") return <AdminPageSkeleton />;
  if (variant === "landing") return <LandingPageSkeleton />;
  return <ClientePageSkeleton />;
}

export function ExperiencePreloader({
  variant = "cliente",
  className,
  percent,
}: {
  variant?: ExperiencePreloaderVariant;
  className?: string;
  percent?: number;
}) {
  return (
    <div
      className={cn(
        "relative flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      aria-label="Carregando experiência"
    >
      <div className="min-h-0 flex-1 overflow-hidden py-2">
        <PageSkeleton variant={variant} />
      </div>
      <LoadingSpinner percent={percent} />
    </div>
  );
}

/** Full-screen overlay. Blocks pointer events until the page is ready. */
export function ExperiencePreloaderOverlay({
  variant = "cliente",
  active,
  percent,
}: {
  variant?: ExperiencePreloaderVariant;
  active: boolean;
  percent?: number;
}) {
  const hydrated = useHydrated();
  if (!active) return null;

  const overlay = (
    <div
      className="experience-preloader-overlay fixed inset-0 z-[120] flex flex-col bg-[var(--bg)]"
      aria-busy="true"
      aria-live="polite"
    >
      <ExperiencePreloader
        variant={variant}
        className="h-dvh"
        percent={percent}
      />
    </div>
  );
  // Inline until hydrated so the server HTML already covers the page; then on <body>.
  return hydrated ? createPortal(overlay, document.body) : overlay;
}
