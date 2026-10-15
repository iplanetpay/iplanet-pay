import { PageHeader } from "@/components/ui/page-header";
import { WhatsappAdminPanel } from "@/components/admin/whatsapp-admin-panel";
import { listWhatsappTemplates } from "@/lib/whatsapp/admin";
import { whatsappConfigured } from "@/lib/whatsapp/client";

export const metadata = { title: "WhatsApp" };

export default async function AdminWhatsappPage() {
  const { templates, error } = await listWhatsappTemplates();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Comunicação"
        title="WhatsApp"
        description="Templates, leads e disparo em massa."
        backFallback="/admin"
        titleAddon={
          <svg viewBox="0 0 24 24" className="h-8 w-8" aria-label={whatsappConfigured() ? "API ligada" : "API desligada"}>
            <path
              fill="none"
              stroke={whatsappConfigured() ? "#25D366" : "#e11d48"}
              strokeWidth="1.7"
              d="M12.04 4.2A7.3 7.3 0 0 0 5.6 16.2L4.4 19.6l3.5-1.1A7.3 7.3 0 1 0 12.04 4.2Z"
            />
          </svg>
        }
      />
      {error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : (
        <WhatsappAdminPanel
          templates={templates}
          apiConfigured={whatsappConfigured()}
        />
      )}
    </div>
  );
}
