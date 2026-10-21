import { Suspense } from "react";
import { MetasScreen } from "@/components/goals/climb/metas-screen";
import { PageHeader } from "@/components/ui/page-header";
import { selectClimbGoal } from "@/lib/goals/climb/goal-cards";
import { loadClimbEntries } from "@/lib/goals/climb/load-entries";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Metas" };

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string }>;
}) {
  const user = await getCurrentUser();
  const entries = user ? await loadClimbEntries(user.id) : [];
  const { meta } = await searchParams;
  const selected = selectClimbGoal(entries, meta);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Jornada"
        title={selected ? selected.goal.name : "Metas"}
        description={selected ? undefined : "Escolha uma meta para ver a viagem até o planeta e o calendário de aportes."}
        showBack={Boolean(selected)}
        backForceHref="/app/metas"
      />
      <Suspense fallback={null}>
        <MetasScreen entries={entries} />
      </Suspense>
    </div>
  );
}
