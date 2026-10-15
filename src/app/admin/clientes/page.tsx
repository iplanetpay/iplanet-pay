import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientesPanel } from "@/components/clients/clientes-panel";
import {
  listStoresForAdmin,
  searchClients,
} from "@/lib/clients/queries";

export const metadata = { title: "Clientes · Admin" };

export default async function AdminClientesPage({
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
        eyebrow="Plataforma"
        title="Clientes"
        description="Busca por nome ou telefone e o detalhe de cada cliente."
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
          detailBasePath="/admin/clientes"
        />
      )}
    </div>
  );
}
