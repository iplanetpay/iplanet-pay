export type ProfileIdentityInput = {
  cpf?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  birthDate?: string | null;
};

export const BRAZIL_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type BrazilState = (typeof BRAZIL_STATES)[number];

export function normalizeCpf(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(digits)) return null;
  return digits;
}

export function formatCpf(raw: string | null | undefined): string | null {
  const digits = normalizeCpf(raw);
  if (!digits) return null;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function phoneDigits(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

export function normalizeState(raw: string | null | undefined): BrazilState | null {
  const value = String(raw ?? "")
    .trim()
    .toUpperCase();
  return (BRAZIL_STATES as readonly string[]).includes(value)
    ? (value as BrazilState)
    : null;
}

export function isValidBirthDate(raw: string | null | undefined, now = new Date()): boolean {
  if (!raw) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }
  if (year < 1900) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return date.getTime() <= today;
}

export function identityMissingMessage(input: ProfileIdentityInput): string | null {
  if (!normalizeCpf(input.cpf)) return "Informe um CPF válido com 11 dígitos.";
  const phone = phoneDigits(input.phone);
  if (phone.length < 10 || phone.length > 13) {
    return "Informe um telefone válido com DDD.";
  }
  if (!(input.city ?? "").trim()) return "Informe a cidade.";
  if (!normalizeState(input.state)) return "Informe o estado (UF).";
  if (!(input.address ?? "").trim()) return "Informe o endereço.";
  if (!(input.addressNumber ?? "").trim()) return "Informe o número.";
  if (!isValidBirthDate(input.birthDate)) {
    return "Informe uma data de nascimento válida.";
  }
  return null;
}

/** Cadastro completo para aportar: CPF, telefone, cidade, UF, endereço, número e nascimento. */
export function profileIdentityComplete(input: ProfileIdentityInput): boolean {
  return identityMissingMessage(input) == null;
}

export function signedInWithGoogle(user: {
  app_metadata?: { provider?: string } | null;
  identities?: Array<{ provider?: string }> | null;
}): boolean {
  if (user.app_metadata?.provider === "google") return true;
  return (user.identities ?? []).some((identity) => identity.provider === "google");
}
