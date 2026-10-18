/** Conta já pode entrar: sessão ativa ou e-mail confirmado no servidor. */
export function resolveSignupAccess(input: {
  hasSession: boolean;
  autoConfirmed: boolean;
}): { needsEmailConfirmation: boolean } {
  if (input.hasSession || input.autoConfirmed) {
    return { needsEmailConfirmation: false };
  }
  return { needsEmailConfirmation: true };
}
