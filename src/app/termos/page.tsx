import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { TERMS_VERSION } from "@/lib/withdrawals/types";
import { CONTRATO_DE_APORTE_ANCHOR, parseTerms, splitBold } from "@/lib/terms/parse";

export const metadata = { title: "Termos de uso" };

function Rich({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, i) =>
        part.bold ? (
          <strong key={i} className="font-semibold text-[var(--ink)]">
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export default function TermosPage() {
  const blocks = parseTerms();
  const headings = blocks.filter((b) => b.kind === "heading");
  return (
    <div className="min-h-screen bg-[var(--bg-subtle)] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <PageHeader eyebrow="Legal" title="Termos de uso" description={TERMS_VERSION} />
        <nav className="mt-6 text-sm">
          <a
            href={`#${CONTRATO_DE_APORTE_ANCHOR}`}
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Contrato de Aporte (cláusula 8)
          </a>
          <details className="mt-3">
            <summary className="cursor-pointer text-[var(--ink-muted)]">Índice</summary>
            <ol className="mt-2 space-y-1">
              {headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="text-[var(--ink-muted)] hover:underline">
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        </nav>
        <Card className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--ink-muted)]">
          {blocks.map((b, i) => {
            if (b.kind === "title") return null;
            if (b.kind === "heading") {
              return (
                <h2
                  key={i}
                  id={b.id}
                  className="scroll-mt-6 pt-4 text-base font-bold tracking-tight text-[var(--ink)]"
                >
                  {b.text}
                </h2>
              );
            }
            if (b.kind === "quote") {
              return (
                <blockquote
                  key={i}
                  className="border-l-2 border-[var(--accent)] bg-[var(--accent-soft)]/40 px-3 py-2"
                >
                  <Rich text={b.text} />
                </blockquote>
              );
            }
            return (
              <p key={i} className="whitespace-pre-line">
                <Rich text={b.text} />
              </p>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
