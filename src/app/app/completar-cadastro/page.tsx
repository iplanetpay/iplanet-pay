import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";
import { getCurrentUser } from "@/lib/auth/session";
import { loadProfileIdentity } from "@/lib/profile/identity-server";

export const metadata = { title: "Completar cadastro" };

export default async function CompletarCadastroPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/app/completar-cadastro");

  if (user.signed_in_with_google) {
    const identity = await loadProfileIdentity(user.id);
    if (identity.readable && identity.complete) redirect("/app");
  }

  return (
    <div className="mx-auto max-w-md space-y-8">
      <PageHeader
        eyebrow="Cadastro"
        title="Complete seu cadastro"
        description="O aporte só fica liberado depois de CPF, telefone, cidade, endereço e data de nascimento."
        size="md"
      />
      <Card>
        <CompleteProfileForm initialPhone={user.phone} />
      </Card>
    </div>
  );
}
