import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { BackButton } from "./back-button";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  titleAddon?: ReactNode;
  className?: string;
  size?: "md" | "lg" | "xl";
  showBack?: boolean;
  backFallback?: string;
  /** When set, Back always goes here (never history.back). */
  backForceHref?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  titleAddon,
  className,
  size = "lg",
  showBack = false,
  backFallback = "/",
  backForceHref,
}: PageHeaderProps) {
  const titleSize =
    size === "xl"
      ? "text-5xl md:text-6xl"
      : size === "lg"
        ? "text-4xl md:text-5xl"
        : "text-3xl md:text-4xl";

  return (
    <div className={cn("space-y-3", className)}>
      {showBack ? (
        <BackButton fallbackHref={backFallback} forceHref={backForceHref} />
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "flex items-center gap-3 font-bold tracking-tight text-[var(--ink)] leading-[1.05]",
              titleSize,
            )}
          >
            {title}
            {titleAddon}
          </h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-base text-[var(--ink-muted)] md:text-lg">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
