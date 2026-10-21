import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { TERMS_OF_USE_PT, TERMS_VERSION } from "@/lib/withdrawals/types";

export const metadata = { title: "Termos de uso" };

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-subtle)] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <PageHeader eyebrow="Legal" title="Termos de uso" description={TERMS_VERSION} />
        <nav className="mt-6 text-sm">
          <a href="#contrato-de-aporte" className="font-semibold text-[var(--accent)] hover:underline">
            Contrato de aporte (item 7)
          </a>
        </nav>
        <Card id="contrato-de-aporte" className="mt-4 scroll-mt-6 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-muted)]">
          {TERMS_OF_USE_PT}
        </Card>
      </div>
    </div>
  );
}
