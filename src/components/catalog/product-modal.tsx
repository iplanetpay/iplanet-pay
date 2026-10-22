"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { MotionModal } from "@/components/ui/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCentsBRL } from "@/lib/utils";
import type { Product } from "@/types/database";
import { RichDescription } from "@/components/catalog/rich-description";

const DRAFT_KEY = "iplanet_goal_draft";

function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = years * 12 + (to.getMonth() - from.getMonth());
  const dayAdj = to.getDate() >= from.getDate() ? 0 : -1;
  return Math.max(1, months + dayAdj || 1);
}

function galleryFor(product: Product): string[] {
  const extras = (product.product_images ?? []).filter(Boolean);
  const main = product.image_url ? [product.image_url] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of [...main, ...extras]) {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

const REMINDER_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

export function ProductModal({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [installments, setInstallments] = useState(12);
  const [cadastrarMeta, setCadastrarMeta] = useState(false);
  const [metaName, setMetaName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [reminderDay, setReminderDay] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    if (!product) return;
    setInstallments(12);
    setCadastrarMeta(false);
    setMetaName(`Meta · ${product.name}`);
    setTargetDate("");
    setReminderDay("");
    setError(null);
    setImgIdx(0);
  }, [product?.id]);

  const gallery = useMemo(
    () => (product ? galleryFor(product) : []),
    [product],
  );

  const price = product?.list_price_cents ?? 0;

  const effectiveInstallments = useMemo(() => {
    if (cadastrarMeta && targetDate) {
      const n = monthsBetween(new Date(), new Date(targetDate + "T12:00:00"));
      return Math.min(24, Math.max(2, n));
    }
    return Math.min(24, Math.max(2, installments));
  }, [cadastrarMeta, targetDate, installments]);

  const installmentCents = Math.floor(price / effectiveInstallments);

  function reserveHref() {
    if (!product) return "/criar-conta";
    return `/criar-conta?product=${encodeURIComponent(product.slug)}`;
  }

  function goReserve() {
    if (!product) return;
    onClose();
    router.push(reserveHref());
  }

  function prevImg() {
    setImgIdx((i) => (i - 1 + gallery.length) % gallery.length);
  }
  function nextImg() {
    setImgIdx((i) => (i + 1) % gallery.length);
  }

  async function saveGoal() {
    if (!product) return;
    setSaving(true);
    setError(null);

    const dayNum = reminderDay ? Number(reminderDay) : null;
    if (
      reminderDay &&
      (!Number.isFinite(dayNum) || (dayNum as number) < 1 || (dayNum as number) > 30)
    ) {
      setError("Escolha um dia entre 1 e 30.");
      setSaving(false);
      return;
    }

    const draft = {
      product_id: product.id,
      product_slug: product.slug,
      name: metaName.trim() || `Meta · ${product.name}`,
      target_date: targetDate,
      reminder_day: dayNum,
      amount_cents: price,
      installment_cents: installmentCents,
      installments_count: effectiveInstallments,
    };

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        needsAuth?: boolean;
      };
      if (data.needsAuth || res.status === 401) {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        onClose();
        router.push(
          `/entrar?next=${encodeURIComponent("/app/catalogo?product=" + product.slug)}`,
        );
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível salvar a meta.");
        return;
      }
      onClose();
      router.push("/app/catalogo?meta=ok");
    } catch {
      setError("Erro de rede.");
    } finally {
      setSaving(false);
    }
  }

  if (!product) return null;

  return (
    <MotionModal
      open={open}
      onClose={onClose}
      labelledBy="product-modal-title"
      className="max-w-xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          {product.category ?? "Apple"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--ink)] transition hover:bg-[var(--line)]"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-y-auto px-5 py-4">
        <div className="relative flex h-56 items-center justify-center bg-white">
          {gallery[imgIdx] ? (
            <Image
              src={gallery[imgIdx]}
              alt={product.name}
              width={280}
              height={280}
              className="h-full w-auto object-contain mix-blend-multiply"
            />
          ) : (
            <div className="h-36 w-36 rounded-full bg-[var(--line)]" />
          )}

          {gallery.length > 1 ? (
            <>
              <button
                type="button"
                onClick={prevImg}
                className="absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--ink)] shadow-md ring-1 ring-black/5 transition hover:bg-white"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={nextImg}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--ink)] shadow-md ring-1 ring-black/5 transition hover:bg-white"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                {imgIdx + 1}/{gallery.length}
              </span>
            </>
          ) : null}
        </div>

        {gallery.length > 1 ? (
          <div className="mt-3 flex justify-center gap-2 overflow-x-auto pb-1">
            {gallery.map((u, i) => (
              <button
                key={u}
                type="button"
                onClick={() => setImgIdx(i)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition ${
                  i === imgIdx
                    ? "border-[var(--accent)] shadow-sm"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
                aria-label={`Imagem ${i + 1}`}
                aria-current={i === imgIdx}
              >
                <Image
                  src={u}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-contain mix-blend-multiply p-1"
                />
              </button>
            ))}
          </div>
        ) : null}

        {gallery.length > 1 ? (
          <div className="mt-2 flex justify-center gap-2">
            {gallery.map((u, i) => (
              <button
                key={`dot-${u}`}
                type="button"
                onClick={() => setImgIdx(i)}
                className={`h-2 w-2 rounded-full transition ${
                  i === imgIdx ? "bg-[var(--accent)]" : "bg-[var(--line)]"
                }`}
                aria-label={`Ir para imagem ${i + 1}`}
              />
            ))}
          </div>
        ) : null}

        <h2
          id="product-modal-title"
          className="mt-4 text-2xl font-bold tracking-tight text-[var(--ink)]"
        >
          {product.name}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {[product.storage, product.color].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-2 text-xl font-semibold text-[var(--ink)]">
          {formatCentsBRL(price)}
        </p>
        {product.description_md?.trim() ? (
          <div className="mt-4">
            <RichDescription source={product.description_md} />
          </div>
        ) : product.description ? (
          <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-[var(--ink-muted)]">
            {product.description}
          </p>
        ) : null}

        <div className="mt-6 rounded-[20px] border border-[var(--line)] bg-white p-4">
          <h3 className="text-sm font-bold text-[var(--ink)]">
            Simulador de aportes
          </h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Simulação de aportes · sem juros de cartão — você define o ritmo via
            Pix
          </p>
          {!cadastrarMeta || !targetDate ? (
            <label className="mt-3 block text-sm">
              <span className="font-medium">Número de parcelas</span>
              <input
                type="range"
                min={2}
                max={24}
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--accent)]"
              />
              <span className="mt-1 block text-[var(--ink-muted)]">
                {installments}× de{" "}
                {formatCentsBRL(Math.floor(price / installments))}
              </span>
            </label>
          ) : null}
          <div className="mt-3 rounded-2xl bg-[var(--accent-soft)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
              Valor por mês
            </p>
            <p className="text-2xl font-bold tracking-tight">
              {formatCentsBRL(installmentCents)}
            </p>
            <p className="text-xs text-[var(--ink-muted)]">
              em {effectiveInstallments} aportes · entrada R$&nbsp;0
            </p>
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[16px] border border-[var(--line)] bg-white p-4">
          <input
            type="checkbox"
            checked={cadastrarMeta}
            onChange={(e) => setCadastrarMeta(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            <span className="block font-semibold text-[var(--ink)]">
              Cadastrar meta
            </span>
            <span className="text-sm text-[var(--ink-muted)]">
              Defina data, lembrete e ritmo de aportes (WhatsApp quando
              configurado).
            </span>
          </span>
        </label>

        {cadastrarMeta ? (
          <div className="mt-4 space-y-3 rounded-[20px] border border-[var(--line)] bg-[var(--bg-subtle)] p-4">
            <Input
              label="Nome da meta"
              value={metaName}
              onChange={(e) => setMetaName(e.target.value)}
              required
            />
            <Input
              label="Data de conclusão"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
            />
            <label className="flex w-full flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--ink)]">
                Dia do lembrete
              </span>
              <select
                value={reminderDay}
                onChange={(e) => setReminderDay(e.target.value)}
                className="h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-[var(--ink)] outline-none transition focus:border-[var(--ink)] focus:ring-4 focus:ring-black/5"
              >
                <option value="">Sem lembrete</option>
                {REMINDER_DAYS.map((d) => (
                  <option key={d} value={d}>
                    Todo dia {d}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[var(--ink-muted)]">
                Nos meses sem esse dia, o lembrete cai no último dia do mês.
                Aviso por volta das 10h (horário de Brasília).
              </span>
            </label>
            {targetDate ? (
              <p className="text-sm text-[var(--ink-muted)]">
                Até a data: ~{effectiveInstallments} meses ·{" "}
                {formatCentsBRL(installmentCents)}/mês
              </p>
            ) : null}
            {error ? (
              <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
            ) : null}
            <Button
              type="button"
              variant="accent"
              fullWidth
              disabled={saving || !targetDate}
              onClick={() => void saveGoal()}
            >
              {saving ? "Salvando…" : "Salvar meta"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--line)] bg-white px-5 py-4 sm:flex-row">
        <Button type="button" variant="accent" fullWidth onClick={goReserve}>
          Reservar / Criar conta
        </Button>
        <Button type="button" variant="outline" fullWidth onClick={onClose}>
          Fechar
        </Button>
      </div>
    </MotionModal>
  );
}

export { DRAFT_KEY as GOAL_DRAFT_KEY };
