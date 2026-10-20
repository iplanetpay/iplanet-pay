import { PageHeader } from "@/components/ui/page-header";
import { SimulatorExperience } from "@/components/reservations/simulator-experience";
import { listCatalogProducts, listProductVariants } from "@/lib/catalog/products";
import { simulatorOptions } from "@/lib/catalog/variants";
import { calendarToday } from "@/lib/reservations/contribution-plan";

export const metadata = { title: "Simulador de aportes" };

export default async function SimuladorPage({
  searchParams,
}: {
  searchParams?: Promise<{ product?: string; variant?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const [{ products }, variants] = await Promise.all([listCatalogProducts(), listProductVariants()]);
  const simulatorProducts = simulatorOptions(
    products.filter((product) => product.active),
    variants,
  );
  const initialProductKey = sp.product ? `${sp.product}:${sp.variant ?? ""}` : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        showBack
        backForceHref="/app"
        eyebrow="Meta"
        title="Simulador de aportes"
        description="Escolha o produto, a data e o ritmo. O valor de cada aporte aparece para fechar a meta."
      />
      <SimulatorExperience products={simulatorProducts} today={calendarToday()} initialProductKey={initialProductKey} />
    </div>
  );
}
