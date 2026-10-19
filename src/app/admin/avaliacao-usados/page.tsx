import { PageHeader } from "@/components/ui/page-header";
import { AdminUsedDevicePanel } from "@/components/trade-in/admin-used-device-panel";

export const metadata = { title: "Avaliação de usados" };

export default async function AdminAvaliacaoUsadosPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Avaliação de usados"
        description="Fila de ofertas de aparelhos usados como pagamento."
      />
      <AdminUsedDevicePanel initialOfferId={sp.id ?? null} />
    </div>
  );
}
