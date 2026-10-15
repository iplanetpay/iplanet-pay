export const NOTICE_KINDS = ["pendencia", "recado", "sorteio", "ganhador", "cupom"] as const;

export type NoticeKind = (typeof NOTICE_KINDS)[number];

export const NOTICE_KIND_LABEL: Record<NoticeKind, string> = {
  pendencia: "Pendência",
  recado: "Recado",
  sorteio: "Sorteio",
  ganhador: "Ganhador",
  cupom: "Cupom",
};

export type NoticeDraft = {
  kind: NoticeKind;
  title: string;
  body: string;
  couponCode?: string | null;
};

export function isNoticeKind(value: string): value is NoticeKind {
  return (NOTICE_KINDS as readonly string[]).includes(value);
}

export function nextRaffleDate(from = new Date()): Date {
  const target = new Date(from);
  target.setMonth(from.getMonth() + 1);
  target.setDate(1);
  target.setHours(0, 0, 0, 0);
  if (target <= from) target.setMonth(target.getMonth() + 1);
  return target;
}

export function formatDateBR(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function raffleDateNotice(from = new Date()): NoticeDraft {
  const label = formatDateBR(nextRaffleDate(from));
  return {
    kind: "sorteio",
    title: "Data do sorteio",
    body: `O próximo sorteio de fichas é em ${label}. Cada R$ 100 em aportes confirmados vale 1 ficha.`,
  };
}

export function winnerNotice(name: string, tickets: number): NoticeDraft | null {
  const winner = name.trim();
  const count = Math.max(0, Math.round(tickets));
  if (!winner) return null;
  const fichas = count === 1 ? "1 ficha" : `${count} fichas`;
  return {
    kind: "ganhador",
    title: "Ganhador do sorteio",
    body: `${winner} ganhou o sorteio com ${fichas}.`,
  };
}

export function normalizeCouponCode(raw: string | null | undefined): string | null {
  const code = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  if (code.length < 3 || code.length > 32) return null;
  if (!/^[A-Z0-9-]+$/.test(code)) return null;
  return code;
}

export function couponNotice(code: string, title: string): NoticeDraft | null {
  const couponCode = normalizeCouponCode(code);
  const label = title.trim();
  if (!couponCode || !label) return null;
  return {
    kind: "cupom",
    title: label,
    body: `Cupom ${couponCode} disponível. Use este código no atendimento da iPlanet.`,
    couponCode,
  };
}

export function unreadNoticeCount(
  notices: Array<{ id: string }>,
  readIds: Iterable<string>,
): number {
  const read = new Set(readIds);
  return notices.filter((notice) => !read.has(notice.id)).length;
}
