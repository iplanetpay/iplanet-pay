import Image from "next/image";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "hero";

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-14 w-14",
  md: "h-24 w-24",
  lg: "h-36 w-36",
  hero: "h-44 w-44 md:h-56 md:w-56",
};

const SIZE_PX: Record<Size, number> = {
  sm: 56,
  md: 96,
  lg: 144,
  hero: 220,
};

export function ProductImage({
  src,
  alt,
  size = "md",
  className,
  imgClassName,
}: {
  src?: string | null;
  alt: string;
  size?: Size;
  className?: string;
  imgClassName?: string;
}) {
  const px = SIZE_PX[size];
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white",
        SIZE_CLASS[size],
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={px}
          height={px}
          className={cn(
            "h-full w-full object-contain p-1.5 mix-blend-multiply",
            imgClassName,
          )}
          // A cached image on a repeat visit can switch loading="lazy" to "eager" before hydration.
          suppressHydrationWarning
        />
      ) : (
        <div
          className="flex h-[70%] w-[55%] items-end justify-center rounded-[22px] bg-gradient-to-b from-[#1c1c1e] to-[#2c2c2e] shadow-[0_16px_32px_rgba(17,17,17,0.14)]"
          aria-hidden
        >
          <div className="mb-2 h-1 w-8 rounded-full bg-white/20" />
        </div>
      )}
    </div>
  );
}
