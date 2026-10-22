"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichDescription } from "@/components/catalog/rich-description";
import { imageMarkdown, RICH_DESCRIPTION_MAX_CHARS } from "@/lib/catalog/rich-description";
import { uploadProductImage } from "@/lib/catalog/product-image-upload";

const TEMPLATE = `## Destaques
- 

## Tela


## Câmera


## Desempenho e chip


## Bateria


## Conectividade


## O que vem na caixa
- 

## Ficha técnica
| Item | Detalhe |
|---|---|
| Tela |  |
`;

export function RichDescriptionEditor({
  value,
  onChange,
  slug,
}: {
  value: string;
  onChange: (next: string) => void;
  slug: string;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    const res = await uploadProductImage(file, slug);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.url) {
      setError(res.error ?? "Falha no upload.");
      return;
    }
    const snippet = imageMarkdown(res.url, file.name.replace(/\.[^.]+$/, ""));
    const el = areaRef.current;
    const at = el ? el.selectionStart : value.length;
    onChange(value.slice(0, at) + snippet + value.slice(at));
    setTab("write");
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-[var(--ink)]">Descrição completa (Markdown)</span>
        <div className="flex gap-1 rounded-full bg-[var(--bg-subtle)] p-1">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === t ? "bg-white shadow-sm" : "text-[var(--ink-muted)]"}`}
            >
              {t === "write" ? "Escrever" : "Prévia"}
            </button>
          ))}
        </div>
      </div>
      {tab === "write" ? (
        <textarea
          ref={areaRef}
          value={value}
          maxLength={RICH_DESCRIPTION_MAX_CHARS}
          onChange={(e) => onChange(e.target.value)}
          placeholder="## Destaques&#10;- …"
          className="min-h-72 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 font-mono text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)] focus:ring-4 focus:ring-black/5"
        />
      ) : (
        <div className="min-h-72 rounded-2xl border border-[var(--line)] bg-white p-4">
          {value.trim() ? <RichDescription source={value} /> : <p className="text-[var(--ink-muted)]">Nada para mostrar.</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          leftIcon={<ImagePlus className="h-4 w-4" />}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Enviando…" : "Inserir foto"}
        </Button>
        {!value.trim() ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(TEMPLATE)}>
            Usar modelo de seções
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs font-medium text-[var(--danger)]">{error}</p> : null}
      <p className="text-xs text-[var(--ink-muted)]">
        Seções com “## ”, listas com “- ”, **negrito**, tabela com “| a | b |” e fotos com “Inserir foto”.
        HTML não é aceito. Aparece no site e no app.
      </p>
    </div>
  );
}
