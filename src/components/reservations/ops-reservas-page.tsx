import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { OpsReservasPanel } from "@/components/reservations/ops-reservas-panel";
import {
  listOpsReservations,
  listStores,
} from "@/lib/reservations/queries";
import {
  isReservationStatus,
  type ReservationStatus,
} from "@/lib/reservations/types";
import type { ClientArea } from "@/lib/clients/activity";
import { Bookmark } from "lucide-react";

export async function OpsReservasPageBody({
  eyebrow,
  title,
  description,
  searchParams,
  lockStoreId,
  clientDetailArea,
}: {
  eyebrow: string;
  title: string;
  description: string;
  searchParams: Promise<{ status?: string; store?: string }>;
  lockStoreId?: string | null;
  clientDetailArea?: ClientArea;
}) {
  const sp = await searchParams;
  const status =
    sp.status && isReservationStatus(sp.status)
      ? (sp.status as ReservationStatus)
      : null;
  const storeId = lockStoreId ?? sp.store ?? null;

  const [{ reservations, error }, { stores }] = await Promise.all([
    listOpsReservations({ status, storeId, limit: 200 }),
    listStores(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        size="lg"
      />

      {error ? (
        <EmptyState
          icon={<Bookmark className="h-6 w-6" />}
          title="Não foi possível carregar"
          description={error}
        />
      ) : (
        <Suspense fallback={<p className="text-[var(--ink-muted)]">Carregando…</p>}>
          <OpsReservasPanel
            reservations={reservations}
            stores={stores}
            lockStoreId={lockStoreId}
            clientDetailArea={clientDetailArea}
          />
        </Suspense>
      )}
    </div>
  );
}
