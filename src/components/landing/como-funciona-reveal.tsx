"use client";

import { motion } from "framer-motion";
import {
  FramerDeviceMockup,
  type DeviceMockupAngle,
  type DeviceMockupColor,
} from "@/components/landing/framer-device-mockup";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.1, margin: "0px 0px 15% 0px" },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

const STEPS: {
  id: string;
  title: string;
  body: string;
  screenSrc: string;
  angle: DeviceMockupAngle;
  color: DeviceMockupColor;
}[] = [
  {
    id: "acesse",
    title: "Acesse a conta",
    body: "Entre com e-mail, Google ou magic link e continue de onde parou.",
    screenSrc: "/images/app-screens/login-mobile.png",
    angle: "straight",
    color: "silver",
  },
  {
    id: "reservas",
    title: "Acompanhe o status das reservas",
    body: "Veja aportes, progresso e status de cada reserva em um só lugar.",
    screenSrc: "/images/app-screens/reservas-mobile.png",
    angle: "straight",
    color: "silver",
  },
  {
    id: "meta",
    title: "Cadastre metas",
    body: "Defina data, lembrete e ritmo de Pix — sem juros de cartão.",
    screenSrc: "/images/app-screens/meta-mobile.png",
    angle: "straight",
    color: "silver",
  },
];

function ScreenImage({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={402}
      height={874}
      loading="eager"
      decoding="async"
      draggable={false}
      style={{
        width: 402,
        height: 874,
        objectFit: "cover",
        display: "block",
        userSelect: "none",
      }}
    />
  );
}

/** Fácil e rápido — three device mockups with real app screen shots. */
export function ComoFuncionaReveal() {
  return (
    <section id="como-funciona" className="relative bg-white">
      <div className="relative bg-white px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="mb-10 max-w-2xl md:mb-14">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              No app
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-[#111] md:text-4xl">
              Fácil e rápido
            </h2>
            <p className="mt-3 text-base text-[#5c5c66] md:text-lg">
              Conta, reservas e metas — o fluxo completo no celular.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 items-start gap-10 sm:grid-cols-3 sm:gap-5 md:gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.id}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.06 * i }}
                className="mx-auto w-full max-w-[230px] scale-[0.92] sm:max-w-[240px] sm:scale-100 md:max-w-none md:scale-[0.88]"
              >
                <FramerDeviceMockup angle={step.angle} color={step.color}>
                  <ScreenImage src={step.screenSrc} alt={step.title} />
                </FramerDeviceMockup>
                <div className="mt-5 text-center sm:px-1">
                  <p className="text-lg font-semibold tracking-tight text-[#111]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-snug text-[#5c5c66]">
                    {step.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
