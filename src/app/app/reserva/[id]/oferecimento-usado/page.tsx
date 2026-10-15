import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getReservationById } from "@/lib/reservations/queries";
import { getLatestUsedDeviceOfferForReservation } from "@/lib/trade-in/queries";
import { PageHeader } from "@/components/ui/page-header";
import { UsedDeviceOfferForm } from "@/components/trade-in/used-device-offer-form";

export const metadata = { title: "Oferecimento de usado" };

export default async function OferecimentoUsadoPage({
  params,
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

  const { offer } = await getLatestUsedDeviceOfferForReservation(id, user.id);
  if (offer?.status === "pending") {
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
            : "Use seu aparelho atual como parte do pagamento."
        }
      />
      <UsedDeviceOfferForm
        reservationId={id}
        backHref={`/app/reserva/${id}`}
      />
    </div>
  );
}
