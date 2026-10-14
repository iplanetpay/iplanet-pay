import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function GuideSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <Card>
        <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">
          {title}
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--ink-muted)] [&_strong]:font-semibold [&_strong]:text-[var(--ink)]">
          {children}
        </div>
      </Card>
    </section>
  );
}

export function GuideList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
