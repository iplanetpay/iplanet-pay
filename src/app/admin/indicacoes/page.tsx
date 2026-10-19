import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { listAllReferrals } from "@/lib/referrals/queries";
import {
  REFERRAL_STATUS_LABEL,
  type ReferralStatus,
} from "@/lib/referrals/types";
import { formatCentsBRL } from "@/lib/utils";
import { ArrowLeft, Gift } from "lucide-react";

export const metadata = { title: "Indicações (admin)" };

export default async function AdminIndicacoesPage() {
  const { referrals, error } = await listAllReferrals(100);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          eyebrow="Admin"
          title="Indicações"
          description="Lista leve de referrals (somente leitura)."
          size="xl"
        />
        <Link href="/admin" className="shrink-0 self-start">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Voltar
          </Button>
        </Link>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {referrals.length === 0 ? (
        <EmptyState
          icon={<Gift className="h-6 w-6" />}
          title="Nenhuma indicação"
          description="Quando clientes aplicarem códigos, aparecerão aqui."
        />
      ) : (
        <div className="space-y-3">
          {referrals.map((r) => (
            <Card
              key={r.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm text-[var(--ink-muted)]">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </p>
                <p className="font-medium">
                  referrer {r.referrer_id.slice(0, 8)}… → referred{" "}
                  {r.referred_id.slice(0, 8)}…
                </p>
                <p className="text-sm text-[var(--ink-muted)]">
                  {formatCentsBRL(r.bonus_amount_cents)}
                  {r.bonus_credited && r.credited_at
                    ? ` · creditado ${new Date(r.credited_at).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              </div>
              <Pill tone={r.bonus_credited ? "accent" : "lavender"}>
                {REFERRAL_STATUS_LABEL[r.status as ReferralStatus] ?? r.status}
              </Pill>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
