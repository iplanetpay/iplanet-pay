import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientesPanel } from "@/components/clients/clientes-panel";
import {
  listStoresForAdmin,
  searchClients,
} from "@/lib/clients/queries";

export const metadata = { title: "Clientes · Staff" };

export default async function StaffClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const [{ clients, error }, { stores }] = await Promise.all([
    searchClients({ q: sp.q ?? null, limit: 150 }),
    listStoresForAdmin(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operação"
        title="Clientes"
        description="Busca por nome/telefone e histórico de reservas."
        size="lg"
      />

      {error ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Não foi possível carregar"
          description={error}
        />
      ) : (
        <ClientesPanel
          clients={clients}
          stores={stores}
          detailBasePath="/staff/clientes"
        />
      )}
    </div>
  );
}
