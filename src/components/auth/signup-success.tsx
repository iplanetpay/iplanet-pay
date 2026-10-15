"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SignupSuccessOverlay({
  open,
  onDone,
}: {
  open: boolean;
  onDone?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => onDone?.(), 2200);
    return () => window.clearTimeout(id);
  }, [open, onDone]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white/90 px-6 backdrop-blur-md">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="signup-success-pop relative flex h-24 w-24 items-center justify-center rounded-full bg-[#0071E3] text-white shadow-[0_16px_40px_rgba(0,113,227,0.35)]">
          <svg viewBox="0 0 52 52" className="h-14 w-14" aria-hidden="true">
            <path
              d="M14 27l8 8 16-18"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="signup-success-check"
            />
          </svg>
        </span>
        <p className="signup-success-text mt-6 text-2xl font-bold tracking-tight text-[var(--ink)]">
          Cadastro concluído com sucesso
        </p>
      </div>
      <style>{`
        @keyframes signup-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes signup-draw {
          from { stroke-dashoffset: 48; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes signup-rise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .signup-success-pop { animation: signup-pop 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .signup-success-check {
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: signup-draw 0.45s 0.35s ease forwards;
        }
        .signup-success-text { animation: signup-rise 0.45s 0.45s ease both; }
      `}</style>
    </div>
  );
}

/** Shows the success animation once when the URL has ?cadastro=ok (Google signup). */
export function SignupWelcomeFromQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("cadastro") !== "ok") return;
    setOpen(true);
  }, [params]);

  if (!open) return null;

  return (
    <SignupSuccessOverlay
      open
      onDone={() => {
        setOpen(false);
        const url = new URL(window.location.href);
        url.searchParams.delete("cadastro");
        router.replace(url.pathname + url.search);
      }}
    />
  );
}
