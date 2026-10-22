import { appBaseUrl, ctaButton, emailShell } from "../layout";

export function aporteReminderEmail(opts: {
  fullName?: string;
  productName: string;
  daysSince: number;
  reservationId: string;
  whatsappUrl?: string | null;
}) {
  const name = opts.fullName?.trim() || "olá";
  const href = `${appBaseUrl()}/app/carteira`;
  const reserva = `${appBaseUrl()}/app/reserva/${opts.reservationId}`;
  const wa = opts.whatsappUrl
    ? `<p style="margin:16px 0 0;font-size:14px;color:#5c5c66;">Precisa de ajuda? <a href="${opts.whatsappUrl}" style="color:#25d366;font-weight:700;">Fale no WhatsApp</a></p>`
    : "";
  const body = `
    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;letter-spacing:-0.02em;">Sentimos sua falta</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#5c5c66;">
      ${name}, faz cerca de <strong style="color:#111">${opts.daysSince} dias</strong> desde o último aporte na reserva de
      <strong style="color:#111">${opts.productName}</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#5c5c66;">
      Sem pressão — quando quiser, gere um Pix e continue no seu ritmo. Seu aparelho continua reservado.
    </p>
    <p style="text-align:center;margin:24px 0;">${ctaButton("Gerar Pix / Wallet", href)}</p>
    <p style="text-align:center;margin:0;">
      <a href="${reserva}" style="color:#0071e3;font-weight:600;font-size:14px;text-decoration:none;">Ver reserva</a>
    </p>
    ${wa}
  `;
  return {
    subject: "Sua reserva iPlanet Pay te espera",
    html: emailShell({
      title: "Lembrete de aporte",
      preheader: "Continue sua reserva no seu ritmo — gere um Pix quando quiser.",
      bodyHtml: body,
    }),
    text: `Há ${opts.daysSince} dias sem aporte em ${opts.productName}. Continue em ${href}`,
  };
}
