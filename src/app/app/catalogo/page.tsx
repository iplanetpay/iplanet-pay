import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Smartphone } from "lucide-react";
import { listCatalogProducts, listProductSwatches } from "@/lib/catalog/products";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { FaqChat } from "@/components/chat/faq-chat";
import { getAppSettings } from "@/lib/settings/queries";

export const metadata = { title: "Catálogo" };

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams?: Promise<{ product?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const [{ products, error }, { settings }, swatches] = await Promise.all([
    listCatalogProducts(),
    getAppSettings(["whatsapp_support"]),
    listProductSwatches(),
  ]);

  const highlight = sp.product
    ? products.find((p) => p.slug === sp.product)
    : null;
  const ordered = highlight
    ? [highlight, ...products.filter((p) => p.id !== highlight.id)]
    : products;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Produtos"
        title="Catálogo"
        description="Escolha o aparelho e a loja de retirada. Estoque sempre disponível."
        showBack
        backFallback="/app"
      />

      {error ? (
        <EmptyState
          icon={<Smartphone className="h-6 w-6" />}
          title="Não foi possível carregar"
          description={error}
        />
      ) : ordered.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="h-6 w-6" />}
          title="Nenhum produto"
          description="Em breve novos aparelhos no catálogo."
        />
      ) : (
        <CatalogBrowser
          products={ordered}
          swatches={swatches}
          highlightId={highlight?.id}
        />
      )}
      <FaqChat whatsappDigits={settings.whatsapp_support} />
    </div>
  );
}
