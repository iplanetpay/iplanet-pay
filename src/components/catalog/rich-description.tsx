import Image from "next/image";
import { Fragment } from "react";
import { parseRichDescription, type RichInline } from "@/lib/catalog/rich-description";

function Inlines({ items }: { items: RichInline[] }) {
  return (
    <>
      {items.map((i, idx) =>
        i.bold ? (
          <strong key={idx} className="font-semibold text-[var(--ink)]">
            {i.text}
          </strong>
        ) : (
          <Fragment key={idx}>{i.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Renderiza products.description_md. Nada de HTML cru: só blocos do parser. */
export function RichDescription({ source }: { source: string | null | undefined }) {
  const blocks = parseRichDescription(source);
  if (!blocks.length) return null;
  return (
    <div className="rich-description space-y-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">
      {blocks.map((b, idx) => {
        switch (b.type) {
          case "heading":
            return b.level === 2 ? (
              <h3 key={idx} className="pt-3 text-lg font-bold tracking-tight text-[var(--ink)]">
                {b.text}
              </h3>
            ) : (
              <h4 key={idx} className="pt-1 text-[15px] font-semibold text-[var(--ink)]">
                {b.text}
              </h4>
            );
          case "paragraph":
            return (
              <p key={idx}>
                <Inlines items={b.inlines} />
              </p>
            );
          case "list":
            return (
              <ul key={idx} className="list-disc space-y-1 pl-5 marker:text-[var(--accent)]">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines items={it} />
                  </li>
                ))}
              </ul>
            );
          case "image":
            return (
              <figure key={idx} className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[var(--line)]">
                <Image
                  src={b.url}
                  alt={b.alt}
                  width={1200}
                  height={1200}
                  sizes="(max-width: 640px) 100vw, 560px"
                  className="h-auto w-full object-contain"
                />
                {b.alt ? (
                  <figcaption className="px-4 py-2 text-xs text-[var(--ink-muted)]">{b.alt}</figcaption>
                ) : null}
              </figure>
            );
          case "table":
            return (
              <div key={idx} className="overflow-x-auto rounded-2xl ring-1 ring-[var(--line)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--bg-subtle)] text-[var(--ink)]">
                    <tr>
                      {b.header.map((h, j) => (
                        <th key={j} className="px-3 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-t border-[var(--line)]">
                        {r.map((c, k) => (
                          <td key={k} className={`px-3 py-2 align-top ${k === 0 ? "font-medium text-[var(--ink)]" : ""}`}>
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
