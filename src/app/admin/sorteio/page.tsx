import { PageHeader } from "@/components/ui/page-header";
import { SorteioAdminClient } from "@/components/admin/sorteio-admin-client";
import { getAporteRanking, getRaffleAdminState } from "@/lib/raffle/queries";
import { RAFFLE_ELIGIBILITY_MESSAGE } from "@/lib/raffle/utils";

export const metadata = { title: "Sorteio" };

export default async function AdminSorteioPage() {
  const [{ rows, error }, admin] = await Promise.all([
    getAporteRanking(200),
    getRaffleAdminState(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Sorteio mensal"
        description={`Ranking por fichas e sorteio ao vivo para mídia / Instagram. ${RAFFLE_ELIGIBILITY_MESSAGE}`}
      />
      {error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : (
        <SorteioAdminClient
          admin={admin}
          entries={rows.map((r) => ({
            userId: r.user_id,
            name: r.full_name,
            tickets: r.tickets,
          }))}
        />
      )}
    </div>
  );
}
