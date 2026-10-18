"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

/** Full-bleed unboxing — Resultado / Seu iPhone, no seu ritmo. */
export function SeuIphoneSection() {
  return (
    <section
      id="seu-iphone"
      className="relative min-h-[100dvh] overflow-hidden bg-black"
    >
      <Image
        src="/images/iphone-18-pro-max-unboxing.png"
        alt=""
        fill
        className="object-cover"
        sizes="100vw"
        priority={false}
        suppressHydrationWarning
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-[100dvh] items-end">
        <motion.div
          {...fadeUp}
          className="mx-auto w-full max-w-6xl px-4 pb-[max(3rem,env(safe-area-inset-bottom,0px))] pt-24 md:px-8 md:pb-20"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Resultado
          </p>
          <h2 className="max-w-3xl text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
            Seu iPhone, no seu ritmo
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75 md:text-xl">
            Da escolha à retirada: iPlanet Pay une as lojas físicas ao Pix no
            seu tempo.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
