import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ReservationStatusPill } from "@/components/reservations/status-pill";
import { ProductImage } from "@/components/products/product-image";
import { formatCentsBRL } from "@/lib/utils";
import {
  productSubtitle,
  reservationProgress,
  shortReservationId,
  type ReservationWithDetails,
} from "@/lib/reservations/types";

export function ReservationCard({
  reservation,
  href,
}: {
  reservation: ReservationWithDetails;
  href?: string | null;
}) {
  const title = reservation.product?.name ?? "Produto";
  const subtitle = productSubtitle(reservation.product);
  const progress = reservationProgress(reservation);
  const body = (
    <Card className="space-y-3">
      <div className="flex gap-3">
        <ProductImage
          src={reservation.product?.image_url}
          alt={title}
          size="sm"
          className="border border-[var(--line)]"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <ReservationStatusPill status={reservation.status} />
            <span className="text-xs text-[var(--ink-muted)]">
              #{shortReservationId(reservation.id)}
            </span>
          </div>
          <h3 className="truncate text-xl font-bold tracking-tight">{title}</h3>
          {subtitle ? (
            <p className="text-sm text-[var(--ink-muted)]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <ProgressBar value={progress} label="Aportes" />
      <p className="text-sm text-[var(--ink-muted)]">
        {formatCentsBRL(reservation.amount_paid_cents)} de{" "}
        {formatCentsBRL(reservation.list_price_cents)}
      </p>
    </Card>
  );

  if (!href) return body;
  return (
    <Link href={href} prefetch className="block transition hover:opacity-90">
      {body}
    </Link>
  );
}
