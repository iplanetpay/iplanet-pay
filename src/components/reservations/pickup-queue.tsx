import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReservationStatusPill } from "@/components/reservations/status-pill";
import { ConfirmRetiradaButton } from "@/components/reservations/confirm-retirada-button";
import { formatCentsBRL } from "@/lib/utils";
import {
  productSubtitle,
  shortReservationId,
  type ReservationWithDetails,
} from "@/lib/reservations/types";
import { PackageCheck } from "lucide-react";

export function PickupQueue({
  reservations,
}: {
  reservations: ReservationWithDetails[];
}) {
  if (reservations.length === 0) {
    return (
      <EmptyState
        icon={<PackageCheck className="h-6 w-6" />}
        title="Nenhuma retirada pendente"
        description="Reservas quitadas prontas para o cliente buscar na loja aparecem aqui."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reservations.map((r) => {
        const title = r.product?.name ?? "Produto";
        const subtitle = productSubtitle(r.product);
        return (
          <Card key={r.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ReservationStatusPill status={r.status} />
              <span className="text-xs text-[var(--ink-muted)]">
                #{shortReservationId(r.id)}
              </span>
            </div>
            <h3 className="text-xl font-bold tracking-tight">{title}</h3>
            {subtitle ? (
              <p className="text-sm text-[var(--ink-muted)]">{subtitle}</p>
            ) : null}
            <p className="text-sm text-[var(--ink-muted)]">
              Pago {formatCentsBRL(r.amount_paid_cents)} ·{" "}
              {r.store?.name ?? "Loja"}
            </p>
            <ConfirmRetiradaButton
              reservationId={r.id}
              productName={r.product?.name}
            />
          </Card>
        );
      })}
    </div>
  );
}
