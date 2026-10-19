import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { AppShell } from "@/components/ui/app-shell";
import { LogoutButton } from "@/components/auth/logout-button";
import { SignupWelcomeFromQuery } from "@/components/auth/signup-success";
import { getCurrentUser } from "@/lib/auth/session";
import { HomeLogo } from "@/components/ui/home-logo";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { FichasIndicator } from "@/components/raffle/fichas-indicator";
import { ProfileCompletionGate } from "@/components/auth/profile-completion-gate";
import { loadProfileIdentity } from "@/lib/profile/identity-server";
import { ClienteHeaderMenu } from "@/components/auth/cliente-header-menu";
import { NoticeBell } from "@/components/notices/notice-bell";

export default async function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/app");

  let pendingProfile = false;
  if (user.role === "cliente" && user.signed_in_with_google) {
    const identity = await loadProfileIdentity(user.id);
    pendingProfile = identity.readable && !identity.complete;
  }

  return (
    <AppShell
      variant="cliente"
      topBar={
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <HomeLogo href="/app" height={44} className="shrink-0" />
            <p className="hidden min-w-0 truncate text-base font-bold tracking-tight sm:block sm:text-lg">
              Olá, {user.full_name}
            </p>
            <UserAvatar
              name={user.full_name}
              avatarUrl={user.avatar_url}
              size={44}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NoticeBell profilePending={pendingProfile} />
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/app/configuracoes" prefetch>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Settings className="h-4 w-4" />}
                  aria-label="Configurações"
                >
                  <span className="hidden sm:inline">Configurações</span>
                </Button>
              </Link>
              <LogoutButton />
            </div>
            <ClienteHeaderMenu />
          </div>
        </div>
      }
    >
      <Suspense fallback={null}>
        <SignupWelcomeFromQuery />
      </Suspense>
      <ProfileCompletionGate pending={pendingProfile}>
        <div className="mb-6">
          <FichasIndicator userId={user.id} />
        </div>
        {children}
      </ProfileCompletionGate>
    </AppShell>
  );
}
