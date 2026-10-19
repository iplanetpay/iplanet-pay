import Link from "next/link";
import { ChevronRight, Truck } from "lucide-react";
import { OpsReservasPageBody } from "@/components/reservations/ops-reservas-page";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Reservas · Admin" };

export default function AdminReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; store?: string }>;
}) {
  return (
    <>
      <OpsReservasPageBody
        eyebrow="Admin"
        title="Reservas"
        description="Busque por cliente, produto ou ID. Cancele ativas e confirme retiradas."
        searchParams={searchParams}
        clientDetailArea="admin"
      />
      <Link href="/admin/retirada-envio" className="mt-8 block">
        <Card className="flex items-center justify-between gap-3 transition hover:border-[var(--accent)]">
          <span className="flex min-w-0 items-center gap-3">
            <Truck className="h-5 w-5 shrink-0 text-[var(--accent)]" />
            <span className="min-w-0">
              <span className="block font-bold">Solicitações de retirada / envio</span>
              <span className="block text-sm text-[var(--ink-muted)]">
                Prepare, envie e confirme na tela Retirada/Envio.
              </span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-[var(--ink-muted)]" />
        </Card>
      </Link>
    </>
  );
}
