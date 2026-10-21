import { Fragment } from "react";
import { parseMarkdown, type MdInline } from "@/lib/support-ai/markdown";
import { cn } from "@/lib/utils";

function Inline({ parts }: { parts: MdInline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.code ? (
          <code key={i} className="rounded bg-black/5 px-1 py-0.5 text-[0.85em]">{p.text}</code>
        ) : p.bold ? (
          <strong key={i}>{p.text}</strong>
        ) : p.italic ? (
          <em key={i}>{p.text}</em>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

export function MarkdownView({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return b.level === 1 ? (
              <h2 key={i} className="text-lg font-bold tracking-tight"><Inline parts={b.inline} /></h2>
            ) : b.level === 2 ? (
              <h3 key={i} className="pt-2 text-base font-bold"><Inline parts={b.inline} /></h3>
            ) : (
              <h4 key={i} className="font-semibold"><Inline parts={b.inline} /></h4>
            );
          case "paragraph":
            return <p key={i}><Inline parts={b.inline} /></p>;
          case "rule":
            return <hr key={i} className="border-[var(--line)]" />;
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={cn("space-y-1 pl-5", b.ordered ? "list-decimal" : "list-disc")}>
                {b.items.map((it, j) => (
                  <li key={j}><Inline parts={it} /></li>
                ))}
              </Tag>
            );
          }
        }
      })}
    </div>
  );
}
