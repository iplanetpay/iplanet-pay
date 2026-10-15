import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  label?: string;
  className?: string;
  /** Extra segment after the blue aportes, in percent of the total. */
  extra?: number;
  extraTone?: "yellow" | "red";
}

export function ProgressBar({
  value,
  label,
  className,
  extra = 0,
  extraTone = "yellow",
}: ProgressBarProps) {
  const cash = Math.max(0, Math.min(100, value));
  const addon = Math.max(0, Math.min(100 - cash, extra));
  const shown = Math.round(cash + (extraTone === "red" ? 0 : addon));
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-[var(--ink-muted)]">{label}</span>
          <span className="font-semibold text-[var(--ink)]">{shown}%</span>
        </div>
      ) : null}
      <div className="flex h-3 w-full overflow-hidden rounded-[var(--radius-pill)] bg-[var(--bg-subtle)]">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-500"
          style={{ width: `${cash}%` }}
        />
        {addon > 0 ? (
          <div
            className={cn(
              "h-full transition-all duration-500",
              extraTone === "red" ? "bg-[#e11d48]" : "bg-[#f5b942]",
            )}
            style={{ width: `${addon}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
