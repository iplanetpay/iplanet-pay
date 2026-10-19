"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Info, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { cn, formatCentsBRL } from "@/lib/utils";
import {
  MAX_IMPORT_ROWS,
  PRODUCT_COLUMNS,
  type ImportAction,
  type ImportResponse,
  type ProductTransferFormat,
} from "@/lib/products/import-schema";

type ImportSuccess = Extract<ImportResponse, { ok: true }>;

const linkButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--bg-subtle)]";

function exportHref(format: ProductTransferFormat, template = false) {
  return `/api/admin/products/export?format=${format}${template ? "&template=1" : ""}`;
}

function actionPill(action: ImportAction) {
  switch (action) {
    case "create":
      return <Pill tone="accent">criar</Pill>;
    case "update":
      return <Pill tone="lavender">atualizar</Pill>;
    case "error":
      return <Pill tone="danger">erro</Pill>;
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

function Modal({
  title,
  description,
  onClose,
  footer,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[88dvh] w-full max-w-4xl flex-col rounded-t-[var(--radius-card)] border border-[var(--line)] bg-white shadow-xl sm:rounded-[var(--radius-card)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[var(--ink-muted)]">{description}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-full p-1 text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)]"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4" data-lenis-prevent>
          {children}
        </div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductsTransferBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportSuccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [exportOpen]);

  async function send(selected: File, mode: "preview" | "apply") {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", selected);
      body.set("mode", mode);
      const res = await fetch("/api/admin/products/import", { method: "POST", body });
      const data = (await res.json()) as ImportResponse;
      if (!data.ok) {
        setError(data.error);
        return;
      }
      setPreview(data);
      if (mode === "apply") router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setFile(null);
    setPreview(null);
    setError(null);
  }

  const importable = preview ? preview.summary.create + preview.summary.update : 0;
  const result = preview?.result ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative" ref={exportRef}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            aria-expanded={exportOpen}
            onClick={() => setExportOpen((open) => !open)}
          >
            Exportar
          </Button>
          {exportOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-lg sm:left-0 sm:right-auto">
              {(["xlsx", "csv"] as const).map((format) => (
                <a
                  key={format}
                  href={exportHref(format)}
                  download
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--bg-subtle)]"
                  onClick={() => setExportOpen(false)}
                >
                  <FileSpreadsheet className="h-4 w-4 text-[var(--accent)]" />
                  {format === "xlsx" ? "Planilha Excel (.xlsx)" : "CSV (.csv)"}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<Upload className="h-4 w-4" />}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy && !preview ? "Lendo…" : "Importar"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            e.target.value = "";
            if (!selected) return;
            setFile(selected);
            setPreview(null);
            void send(selected, "preview");
          }}
        />
      </div>
      {error && !preview ? <p className="text-sm font-medium text-[var(--danger)]">{error}</p> : null}

      {preview && file ? (
        <Modal
          title={result ? "Importação concluída" : "Pré-visualização da importação"}
          description={`${preview.fileName} · ${preview.rows.length} linha(s)`}
          onClose={close}
          footer={
            result ? (
              <Button type="button" variant="accent" onClick={close}>
                Concluir
              </Button>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={close} disabled={busy}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  disabled={busy || importable === 0}
                  onClick={() => void send(file, "apply")}
                >
                  {busy ? "Importando…" : `Importar ${importable} produto(s)`}
                </Button>
              </>
            )
          }
        >
          <div className="space-y-4">
            {preview.mock ? (
              <p className="rounded-2xl bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--ink-muted)]">
                Modo demonstração: nada é gravado no banco.
              </p>
            ) : null}
            {error ? <p className="text-sm font-medium text-[var(--danger)]">{error}</p> : null}

            {result ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Criados" value={result.created} />
                <Stat label="Atualizados" value={result.updated} />
                <Stat label="Ignorados (com erro)" value={result.skipped} tone={result.skipped ? "danger" : undefined} />
                <Stat label="Variantes criadas" value={result.variantsCreated} />
                <Stat label="Variantes atualizadas" value={result.variantsUpdated} />
                <Stat label="Falhas ao gravar" value={result.failed} tone={result.failed ? "danger" : undefined} />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 text-sm">
                <Pill tone="accent">{preview.summary.create} para criar</Pill>
                <Pill tone="lavender">{preview.summary.update} para atualizar</Pill>
                <Pill tone={preview.summary.error ? "danger" : "neutral"}>
                  {preview.summary.error} com erro (serão ignorados)
                </Pill>
              </div>
            )}

            {result?.failures.length ? (
              <ul className="space-y-1 text-sm text-[var(--danger)]">
                {result.failures.map((f, i) => (
                  <li key={`${f.line}-${i}`}>
                    Linha {f.line}: {f.error}
                  </li>
                ))}
              </ul>
            ) : null}

            {preview.unknownHeaders.length ? (
              <p className="text-sm text-[var(--ink-muted)]">
                Colunas ignoradas: {preview.unknownHeaders.join(", ")}
              </p>
            ) : null}

            {!result ? (
              <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[var(--bg-subtle)] text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                    <tr>
                      <th className="px-3 py-2">Linha</th>
                      <th className="px-3 py-2">Ação</th>
                      <th className="px-3 py-2">Nome</th>
                      <th className="px-3 py-2">Slug</th>
                      <th className="px-3 py-2">Categoria</th>
                      <th className="px-3 py-2">Preço</th>
                      <th className="px-3 py-2">Variantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {preview.rows.map((row) => (
                      <tr key={row.line} className={cn(row.errors.length > 0 && "bg-red-50/60")}>
                        <td className="px-3 py-2 align-top tabular-nums">{row.line}</td>
                        <td className="px-3 py-2 align-top">{actionPill(row.action)}</td>
                        <td className="px-3 py-2 align-top">
                          <p className="font-medium">{row.name || "—"}</p>
                          {row.errors.length ? (
                            <ul className="mt-1 space-y-0.5 text-xs text-[var(--danger)]">
                              {row.errors.map((e) => (
                                <li key={e}>{e}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-[var(--ink-muted)]">{row.slug || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.category || "—"}</td>
                        <td className="px-3 py-2 align-top tabular-nums">
                          {row.price_cents ? formatCentsBRL(row.price_cents) : "—"}
                        </td>
                        <td className="px-3 py-2 align-top tabular-nums">{row.variants || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-3">
      <p className="text-xs text-[var(--ink-muted)]">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", tone === "danger" && "text-[var(--danger)]")}>{value}</p>
    </div>
  );
}

export function ImportRulesButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        leftIcon={<Info className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        Regras de importação
      </Button>
      {open ? (
        <Modal
          title="Regras de importação"
          description="Como montar a planilha para criar ou atualizar produtos em lote."
          onClose={() => setOpen(false)}
          footer={
            <>
              <a href={exportHref("xlsx", true)} download className={linkButton}>
                <Download className="h-4 w-4" />
                Modelo .xlsx
              </a>
              <a href={exportHref("csv", true)} download className={linkButton}>
                <Download className="h-4 w-4" />
                Modelo .csv
              </a>
            </>
          }
        >
          <div className="space-y-5 text-sm leading-relaxed">
            <section className="space-y-1">
              <h3 className="font-bold">Arquivo</h3>
              <ul className="list-disc space-y-1 pl-5 text-[var(--ink-muted)]">
                <li>Formatos aceitos: .xlsx (primeira aba) ou .csv. Até 5 MB e {MAX_IMPORT_ROWS} produtos.</li>
                <li>A primeira linha é o cabeçalho com os nomes das colunas abaixo (maiúsculas e acentos são ignorados). Colunas extras são ignoradas.</li>
                <li>CSV pode usar ponto e vírgula, vírgula ou tab como separador. Use aspas em textos que contenham o separador.</li>
                <li>O arquivo exportado segue o mesmo formato: exporte, edite e importe de volta.</li>
              </ul>
            </section>

            <section className="space-y-1">
              <h3 className="font-bold">Criar ou atualizar</h3>
              <ul className="list-disc space-y-1 pl-5 text-[var(--ink-muted)]">
                <li>Com <code>id</code> preenchido, o produto com esse id é atualizado.</li>
                <li>Sem <code>id</code>, procuramos pelo <code>slug</code> (ou pelo slug gerado de nome + armazenamento). Se existir, atualiza; senão, cria.</li>
                <li>Coluna opcional ausente do arquivo mantém o valor atual. Coluna presente com célula vazia limpa o valor (cor, imagens, descrição).</li>
                <li>Linhas com erro são mostradas na pré-visualização e ignoradas; as demais podem ser importadas.</li>
              </ul>
            </section>

            <section className="space-y-1">
              <h3 className="font-bold">Formatos</h3>
              <ul className="list-disc space-y-1 pl-5 text-[var(--ink-muted)]">
                <li>
                  <strong>Preço</strong> em reais: <code>9999,00</code>, <code>9.999,00</code>, <code>9999.00</code> ou{" "}
                  <code>R$ 9.999,00</code>. Ponto seguido de 3 dígitos é separador de milhar (<code>9.999</code> = 9 mil).
                </li>
                <li>
                  <strong>Ativo</strong>: <code>sim</code> / <code>não</code> (também <code>true</code>/<code>false</code>,{" "}
                  <code>1</code>/<code>0</code>). Vazio = sim para novos e mantém o atual nas atualizações.
                </li>
                <li>
                  <strong>Imagens</strong>: URLs começando com <code>https://</code> ou <code>/</code>, separadas por <code>|</code>.
                </li>
                <li>
                  <strong>Variantes</strong>: separadas por <code>|</code>, cada uma como{" "}
                  <code>modelo / cor / armazenamento / preço</code>. Ex.:{" "}
                  <code>iPhone 17 / Azul / 256 GB / 7999,00 | iPhone 17 / / 512 GB / 9499,00</code>. Variantes listadas são
                  criadas ou têm o preço atualizado; as que não aparecem não são removidas.
                </li>
                <li>
                  <strong>Categoria</strong>: nome da aba do catálogo. Se não existir, é criada.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold">Colunas</h3>
              <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
                <table className="w-full min-w-[640px] text-left">
                  <thead className="bg-[var(--bg-subtle)] text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                    <tr>
                      <th className="px-3 py-2">Coluna</th>
                      <th className="px-3 py-2">Obrigatória</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {PRODUCT_COLUMNS.map((c) => (
                      <tr key={c.key}>
                        <td className="px-3 py-2 align-top font-mono text-xs font-semibold">{c.key}</td>
                        <td className="px-3 py-2 align-top">
                          <Pill tone={c.required ? "accent" : "neutral"}>{c.required ? "sim" : "não"}</Pill>
                        </td>
                        <td className="px-3 py-2 align-top text-[var(--ink-muted)]">{c.description}</td>
                        <td className="px-3 py-2 align-top text-xs">{c.example || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
