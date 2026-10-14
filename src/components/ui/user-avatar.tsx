import { cn } from "@/lib/utils";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 44,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = initialsFromName(name);

  if (avatarUrl) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-full border border-[var(--line)] bg-[var(--bg-subtle)]",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* Native img: Google profile photos are on lh3.googleusercontent.com. */}
        <img
          src={avatarUrl}
          alt={name}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-[#0071E3]",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, Math.round(size * 0.36)),
        backgroundColor: "rgba(0, 113, 227, 0.12)",
      }}
      aria-label={name}
    >
      {initials}
    </span>
  );
}
