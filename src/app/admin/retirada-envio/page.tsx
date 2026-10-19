import { FulfillmentPanel } from "@/components/admin/fulfillment-panel";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Retirada/Envio · Admin" };

export default function AdminRetiradaEnvioPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Retirada/Envio"
        description="Aparelhos com retirada ou entrega solicitada: prepare, envie e confirme a entrega."
      />
      <FulfillmentPanel />
    </div>
  );
}
