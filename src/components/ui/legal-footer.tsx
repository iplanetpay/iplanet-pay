import Link from "next/link";
import { LEGAL_FOOTER_LINKS } from "@/lib/navigation/legal-footer";

/** Guia e Termos de uso, fixos acima do dock. */
export function LegalFooter() {
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-[calc(3.45rem+env(safe-area-inset-bottom))] z-30 md:bottom-24">
      <p className="pointer-events-auto text-center text-xs text-[var(--ink-muted)]">
        {LEGAL_FOOTER_LINKS.map((link, index) => (
          <span key={link.href}>
            {index > 0 ? " · " : null}
            <Link href={link.href} className="underline">
              {link.label}
            </Link>
          </span>
        ))}
      </p>
    </footer>
  );
}
