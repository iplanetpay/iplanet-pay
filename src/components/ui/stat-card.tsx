import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { statValueFontSize } from "@/lib/admin/stat-value";

export function StatCard({
  label,
  value,
  className,
  valueClassName,
  maxRem,
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
  maxRem?: number;
}) {
  return (
    <Card className={cn("@container min-w-0 bg-white", className)}>
      <p className="text-sm text-[var(--ink-muted)]">{label}</p>
      <p
        className={cn(
          "mt-2 font-bold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere]",
          valueClassName,
        )}
        style={{ fontSize: statValueFontSize(value, maxRem) }}
      >
        {value}
      </p>
    </Card>
  );
}
