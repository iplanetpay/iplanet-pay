import { Suspense } from "react";
import { listCatalogProducts, listProductSwatches } from "@/lib/catalog/products";
import { getCurrentUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/roles";
import { listCategories } from "@/lib/catalog/categories";
import { LandingCatalog } from "@/components/landing/landing-catalog";
import { FaqChat } from "@/components/chat/faq-chat";
import { getAppSettings } from "@/lib/settings/queries";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { ExperiencePreloader } from "@/components/ui/experience-preloader";

async function LandingPageContent() {
  const [{ products, error: catalogError }, { categories }, { settings }, swatches, user] = await Promise.all([
    listCatalogProducts(),
    listCategories(),
    getAppSettings(["whatsapp_support"]),
    listProductSwatches(),
    getCurrentUser(),
  ]);

  const landingProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    model: p.model,
    storage: p.storage,
    color: p.color,
    list_price_cents: p.list_price_cents,
    image_url: p.image_url,
    description: p.description ?? null,
    product_images: p.product_images ?? [],
    active: p.active,
    category: p.category,
    category_id: p.category_id,
  }));

  const landingCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  return (
    <>
      <PageViewTracker path="/" />
      <LandingCatalog
        products={landingProducts as never}
        categories={landingCategories}
        swatches={swatches}
        catalogError={catalogError}
        homeHref={user ? homeForRole(user.role) : null}
      />
      <FaqChat whatsappDigits={settings.whatsapp_support} />
    </>
  );
}

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <ExperiencePreloader variant="landing" className="min-h-screen" />
      }
    >
      <LandingPageContent />
    </Suspense>
  );
}
