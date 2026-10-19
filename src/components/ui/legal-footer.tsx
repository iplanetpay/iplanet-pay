import Link from "next/link";
import { LEGAL_FOOTER_LINKS } from "@/lib/navigation/legal-footer";

/** Guia e Termos de uso, fixos acima do dock no desktop. No mobile ficam no menu do header. */
export function LegalFooter() {
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-24 z-30 hidden md:block">
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
