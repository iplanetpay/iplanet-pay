import Image from "next/image";
import { wordmarkBox } from "@/lib/brand/wordmark";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: number;
  className?: string;
  /** Invert/lighten for dark backgrounds (compact mark only) */
  onDark?: boolean;
  priority?: boolean;
  /**
   * wordmark = horizontal logo-iplanet-pay (landing header).
   * mark = same pay wordmark, scaled for compact chrome (sidebar collapsed, top bar).
   */
  variant?: "mark" | "wordmark";
  /** Explicit wordmark height. Width follows the cropped logo aspect. Default 48. */
  height?: number;
}

export function BrandLogo({
  size = 40,
  className,
  onDark = false,
  priority = false,
  variant = "mark",
  height,
}: BrandLogoProps) {
  if (variant === "wordmark") {
    const box = wordmarkBox(height ?? 48);
    return (
      <Image
        src="/logo-iplanet-pay.png"
        alt="iPlanet Pay"
        width={box.width}
        height={box.height}
        priority={priority}
        suppressHydrationWarning
        className={cn("rounded-xl object-contain", className)}
        style={box}
      />
    );
  }

  const box = wordmarkBox(size);
  return (
    <Image
      src="/logo-iplanet-pay.png"
      alt="iPlanet Pay"
      width={box.width}
      height={box.height}
      priority={priority}
      suppressHydrationWarning
      className={cn(
        "max-w-full object-contain",
        onDark && "brightness-0 invert",
        className,
      )}
      style={{ ...box, maxWidth: "100%" }}
    />
  );
}
