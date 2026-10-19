"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCentsBRL } from "@/lib/utils";
import type { AdminProduct } from "@/lib/catalog/admin-products";
import type { ProductCategory } from "@/types/database";
import { ProductVariantsPanel } from "@/components/admin/product-variants-panel";
import { ImportRulesButton, ProductsTransferBar } from "@/components/admin/products-transfer";

const NEW_CAT = "__new__";

type FormState = {
  id?: string;
  name: string;
  slug: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  list_price_reais: string;
  image_url: string;
  /** Extra gallery URLs; first cover is image_url */
  product_images: string[];
  description: string;
  active: boolean;
  category_id: string;
  new_category_name: string;
};

const emptyForm = (): FormState => ({
  name: "",
  slug: "",
  brand: "Apple",
  model: "",
  storage: "",
  color: "",
  list_price_reais: "",
  image_url: "",
  product_images: [],
  description: "",
  active: true,
  category_id: "",
  new_category_name: "",
});

function reaisToCents(v: string): number {
  const normalized = v.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function centsToReais(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ProdutosAdminPanel({
  products,
  categories,
}: {
  products: AdminProduct[];
  categories: ProductCategory[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [catName, setCatName] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  const [draftVariants, setDraftVariants] = useState<
    Array<{ model: string; color: string; storage: string; price_cents: number }>
  >([]);
  const [draftModel, setDraftModel] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const [draftStorage, setDraftStorage] = useState("");
  const [draftPrice, setDraftPrice] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    );
  }, [products, filter]);

  function startEdit(p: AdminProduct) {
    setError(null);
    setMessage(null);
    setForm({
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      model: p.model,
      storage: p.storage,
      color: p.color ?? "",
      list_price_reais: centsToReais(p.list_price_cents),
      image_url: p.image_url ?? "",
      product_images: (p.product_images ?? []).filter(Boolean),
      description: p.description ?? "",
      active: p.active,
      category_id: p.category_id ?? "",
      new_category_name: "",
    });
  }

  function resetForm() {
    setForm(emptyForm());
    setError(null);
    setMessage(null);
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const list_price_cents = reaisToCents(form.list_price_reais);
    const creatingNewCat = form.category_id === NEW_CAT;
    const body = {
      id: form.id,
      name: form.name,
      slug: form.slug || undefined,
      brand: form.brand,
      model: form.model,
      storage: form.storage,
      color: form.color || null,
      list_price_cents,
      image_url: form.image_url || null,
      product_images: form.product_images
        .map((u) => u.trim())
        .filter(Boolean)
        .filter((u) => u !== (form.image_url || "").trim())
        .filter((u, i, arr) => arr.indexOf(u) === i),
      description: form.description || null,
      active: form.active,
      category_id: creatingNewCat ? null : form.category_id || null,
      new_category_name: creatingNewCat ? form.new_category_name : null,
    };

    try {
      const res = await fetch("/api/admin/products", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        product?: { id: string };
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao salvar produto.");
        return;
      }
      if (!form.id && data.product?.id) {
        for (const variant of draftVariants) {
          await fetch(`/api/admin/products/${data.product.id}/variants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(variant),
          });
        }
      }
      setMessage(form.id ? "Produto atualizado." : "Produto criado.");
      setDraftVariants([]);
      resetForm();
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(p: AdminProduct) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, active: !p.active }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao alterar status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function createCatOnly(e: React.FormEvent) {
    e.preventDefault();
    setCatLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao criar categoria.");
        return;
      }
      setCatName("");
      setMessage("Categoria criada — nova aba no catálogo.");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setCatLoading(false);
    }
  }

  async function toggleCategoryActive(c: ProductCategory) {
    setCatLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, active: !c.active }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao atualizar categoria.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setCatLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {(error || message) && (
        <p
          className={
            error
              ? "text-sm font-medium text-[var(--danger)]"
              : "text-sm font-medium text-[var(--accent)]"
          }
        >
          {error ?? message}
        </p>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold tracking-tight">
            {form.id ? "Editar produto" : "Novo produto"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Estoque infinito — sem controle de quantidade.
          </p>
          <form className="mt-4 space-y-3" onSubmit={saveProduct}>
            <Input
              label="Nome"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Modelo"
                value={form.model}
                onChange={(e) =>
                  setForm((f) => ({ ...f, model: e.target.value }))
                }
                required
              />
              <Input
                label="Armazenamento"
                value={form.storage}
                onChange={(e) =>
                  setForm((f) => ({ ...f, storage: e.target.value }))
                }
                placeholder="256 GB"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Cor"
                value={form.color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, color: e.target.value }))
                }
              />
              <Input
                label="Marca"
                value={form.brand}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brand: e.target.value }))
                }
              />
            </div>
            <Input
              label="Preço (R$)"
              value={form.list_price_reais}
              onChange={(e) =>
                setForm((f) => ({ ...f, list_price_reais: e.target.value }))
              }
              placeholder="7999,00"
              required
            />
            <Input
              label="Slug (opcional)"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              hint="Gerado automaticamente se vazio"
            />
            <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-subtle)] p-4">
              <div>
                <p className="text-sm font-semibold">Imagens</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  A primeira é a capa (image_url). Demais vão em product_images.
                </p>
              </div>
              <Input
                label="Capa (URL)"
                value={form.image_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, image_url: e.target.value }))
                }
                placeholder="/products/iphone-18-pro.png"
              />
              {form.product_images.map((url, idx) => (
                <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Input
                    label={`Imagem ${idx + 2}`}
                    value={url}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.product_images];
                        next[idx] = e.target.value;
                        return { ...f, product_images: next };
                      })
                    }
                    placeholder="/products/..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        product_images: f.product_images.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    product_images: [...f.product_images, ""],
                  }))
                }
              >
                Adicionar imagem
              </Button>
            </div>
            <Textarea
              label="Descrição"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Copy de marketing em português…"
              hint="Exibida no modal do catálogo (pt-BR)"
            />

            <Select
              label="Categoria"
              value={form.category_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category_id: e.target.value,
                  new_category_name:
                    e.target.value === NEW_CAT ? f.new_category_name : "",
                }))
              }
              required
            >
              <option value="">Selecione…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.active ? " (inativa)" : ""}
                </option>
              ))}
              <option value={NEW_CAT}>+ Criar nova categoria</option>
            </Select>

            {form.category_id === NEW_CAT ? (
              <Input
                label="Nome da nova categoria"
                value={form.new_category_name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    new_category_name: e.target.value,
                  }))
                }
                placeholder="Ex.: iPad"
                required
              />
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
                className="h-4 w-4 rounded border-[var(--line)]"
              />
              Produto ativo no catálogo
            </label>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" variant="accent" disabled={loading}>
                {loading ? "Salvando…" : form.id ? "Salvar" : "Criar produto"}
              </Button>
              {form.id ? (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancelar edição
                </Button>
              ) : null}
            </div>
          </form>
          {form.id ? <ProductVariantsPanel productId={form.id} /> : (
            <div className="mt-6 space-y-3 rounded-2xl border border-dashed border-[var(--line)] p-4">
              <h3 className="text-lg font-bold">Variantes (SKU)</h3>
              <p className="text-sm text-[var(--ink-muted)]">
                Inclua modelo, cor e armazenamento antes de criar o produto.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input label="Modelo" value={draftModel} onChange={(e) => setDraftModel(e.target.value)} />
                <Input label="Cor" value={draftColor} onChange={(e) => setDraftColor(e.target.value)} />
                <Input label="Armazenamento" value={draftStorage} onChange={(e) => setDraftStorage(e.target.value)} />
                <Input label="Preço (R$)" value={draftPrice} onChange={(e) => setDraftPrice(e.target.value)} />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const price_cents = reaisToCents(draftPrice);
                  if (!price_cents) {
                    setError("Informe um preço válido para a variante.");
                    return;
                  }
                  setDraftVariants((current) => [
                    ...current,
                    {
                      model: draftModel,
                      color: draftColor,
                      storage: draftStorage,
                      price_cents,
                    },
                  ]);
                  setDraftModel("");
                  setDraftColor("");
                  setDraftStorage("");
                  setDraftPrice("");
                }}
              >
                Adicionar variante
              </Button>
              <ul className="space-y-1 text-sm">
                {draftVariants.map((variant, index) => (
                  <li key={`${variant.color}-${variant.storage}-${index}`}>
                    {[variant.model, variant.color, variant.storage].filter(Boolean).join(" · ")}{" "}
                    · {formatCentsBRL(variant.price_cents)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-tight">Categorias</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Novas categorias ativas aparecem como abas na landing.
          </p>
          <ul className="mt-4 space-y-2">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg-subtle)] px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-[var(--ink-muted)]">/{c.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={c.active ? "accent" : "neutral"}>
                    {c.active ? "ativa" : "inativa"}
                  </Pill>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={catLoading}
                    onClick={() => void toggleCategoryActive(c)}
                  >
                    {c.active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={createCatOnly}>
            <Input
              label="Nova categoria"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Ex.: iPad"
              required
            />
            <div className="flex items-end">
              <Button
                type="submit"
                variant="outline"
                disabled={catLoading}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Criar
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Produtos</h2>
              <p className="text-sm text-[var(--ink-muted)]">
                {products.length} cadastrado(s)
              </p>
            </div>
            <ProductsTransferBar />
          </div>
          <Input
            label="Buscar"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Nome, categoria, slug…"
            className="sm:max-w-xs"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title="Nenhum produto"
            description="Crie o primeiro produto no formulário acima."
          />
        ) : (
          <div className="grid gap-3">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-bold">{p.name}</h3>
                    <Pill tone="lavender">{p.category ?? "—"}</Pill>
                    <Pill tone={p.active ? "accent" : "neutral"}>
                      {p.active ? "ativo" : "inativo"}
                    </Pill>
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    {[p.storage, p.color].filter(Boolean).join(" · ")} ·{" "}
                    {formatCentsBRL(p.list_price_cents)}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)]">/{p.slug}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(p)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={loading}
                    onClick={() => void toggleActive(p)}
                  >
                    {p.active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
        <div className="mt-4">
          <ImportRulesButton />
        </div>
      </section>
    </div>
  );
}
