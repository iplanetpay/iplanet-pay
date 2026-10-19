import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getReservationById } from "@/lib/reservations/queries";
import { MAX_TRADE_IN_DEVICES } from "@/lib/trade-in/devices";
import { isLiveOffer } from "@/lib/trade-in/offer-state";
import { listUsedDeviceOffersForReservation } from "@/lib/trade-in/queries";
import { PageHeader } from "@/components/ui/page-header";
import { UsedDeviceOfferForm } from "@/components/trade-in/used-device-offer-form";

export const metadata = { title: "Oferecimento de usado" };

export default async function OferecimentoUsadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reavaliar?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const reavaliar = query.reavaliar === "1";
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=/app/reserva/${id}/oferecimento-usado`);

  const { reservation, error } = await getReservationById(id);
  if (error || !reservation) notFound();
  if (reservation.user_id !== user.id) redirect("/app");
  if (reservation.status !== "ativa") {
    redirect(`/app/reserva/${id}`);
  }

  const { offers } = await listUsedDeviceOffersForReservation(id, user.id);
  const live = offers.filter(isLiveOffer);
  if (live.length >= MAX_TRADE_IN_DEVICES) {
    redirect(`/app/reserva/${id}`);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        showBack
        backForceHref={`/app/reserva/${id}`}
        eyebrow="Reserva"
        title={reavaliar ? "Reavaliar aparelho" : "Oferecimento de usado"}
        description={
          reavaliar
            ? "Envie novas fotos e informe um novo valor proposto."
            : "Use um ou mais aparelhos como parte do pagamento."
        }
      />
      <UsedDeviceOfferForm
        reservationId={id}
        backHref={`/app/reserva/${id}`}
        liveCount={live.length}
        liveImeis={live.map((o) => o.imei)}
        maxDevices={MAX_TRADE_IN_DEVICES}
      />
    </div>
  );
}
