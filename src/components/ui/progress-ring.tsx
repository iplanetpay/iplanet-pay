import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
  /** Segunda fatia (ex.: crédito de usado em amarelo), desenhada logo após `value`. */
  secondaryValue?: number;
  secondaryColor?: string;
}

export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  className,
  label,
  secondaryValue = 0,
  secondaryColor,
}: ProgressRingProps) {
  const primary = Math.max(0, Math.min(100, value));
  const secondary = Math.max(0, Math.min(100 - primary, secondaryValue));
  const clamped = primary + secondary;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      data-testid="progresso-circular"
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-subtle)"
          strokeWidth={stroke}
        />
        {secondary > 0 && secondaryColor ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={secondaryColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (clamped / 100) * circumference}
            data-testid="progresso-usado"
          />
        ) : null}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (primary / 100) * circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-tight">{clamped}%</span>
        {label ? (
          <span className="text-xs text-[var(--ink-muted)]">{label}</span>
        ) : null}
      </div>
    </div>
  );
}
