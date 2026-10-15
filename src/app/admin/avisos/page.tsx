import { PageHeader } from "@/components/ui/page-header";
import { AvisosAdminPanel } from "@/components/admin/avisos-admin-panel";

export const metadata = { title: "Avisos" };

export default function AdminAvisosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Avisos"
        description="Cadastre cupons e dispare recados, pendências, data do sorteio e ganhador. O cliente vê tudo no sininho."
      />
      <AvisosAdminPanel />
    </div>
  );
}
