import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { cn } from "@/lib/utils";

export function HomeLogo({
  href,
  height = 44,
  className,
  priority = false,
  label = "Ir para o início",
}: {
  href: string;
  height?: number;
  className?: string;
  priority?: boolean;
  label?: string;
}) {
  return (
    <Link href={href} aria-label={label} className={cn("inline-flex shrink-0", className)}>
      <BrandLogo variant="wordmark" height={height} priority={priority} />
    </Link>
  );
}
