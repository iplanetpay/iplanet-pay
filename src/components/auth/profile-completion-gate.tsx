"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const COMPLETE_PATH = "/app/completar-cadastro";

export function ProfileCompletionGate({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = !pending || pathname === COMPLETE_PATH;

  useEffect(() => {
    if (!allowed) router.replace(COMPLETE_PATH);
  }, [allowed, router]);

  if (!allowed) return null;
  return children;
}
