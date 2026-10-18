import { PageHeader } from "@/components/ui/page-header";
import { SimulatorExperience } from "@/components/reservations/simulator-experience";
import { listCatalogProducts } from "@/lib/catalog/products";
import { calendarToday } from "@/lib/reservations/contribution-plan";

export const metadata = { title: "Simulador de aportes" };

export default async function SimuladorPage() {
  const { products } = await listCatalogProducts();
  const simulatorProducts = products
    .filter((product) => product.active)
    .map((product) => ({
      id: product.id,
      name: product.name,
      listPriceCents: product.list_price_cents,
    }));

  return (
    <div className="space-y-8">
      <PageHeader
        showBack
        backForceHref="/app"
        eyebrow="Meta"
        title="Simulador de aportes"
        description="Escolha o produto, a data e o ritmo. O valor de cada aporte aparece para fechar a meta."
      />
      <SimulatorExperience products={simulatorProducts} today={calendarToday()} />
    </div>
  );
}
