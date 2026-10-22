/**
 * Regras de acesso da simulação de pagamento (somente teste).
 * Puro, sem dependências: usado pela rota e pelos testes.
 */

/** Liga só com ALLOW_PAYMENT_SIMULATION=true (ou no modo mock local). */
export function paymentSimulationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.ALLOW_PAYMENT_SIMULATION?.trim().toLowerCase() === "true") return true;
  return env.USE_MOCK_AUTH === "true" || env.NEXT_PUBLIC_USE_MOCK_AUTH === "true";
}

export type SimulationDecision =
  | { allow: true }
  | { allow: false; status: 401 | 403 | 404; error: string };

/**
 * 404 com a flag desligada (a rota "não existe" em produção real),
 * 401 sem sessão, 403 se o aporte não é do usuário. Com a flag ligada,
 * qualquer dono autenticado do aporte pode simular (modo teste).
 */
export function decideSimulation(input: {
  enabled: boolean;
  userId: string | null | undefined;
  ownerId: string | null | undefined;
}): SimulationDecision {
  if (!input.enabled) return { allow: false, status: 404, error: "Not found" };
  if (!input.userId) return { allow: false, status: 401, error: "Entre para continuar." };
  if (!input.ownerId || input.ownerId !== input.userId) {
    return { allow: false, status: 403, error: "Este pagamento não é da sua conta." };
  }
  return { allow: true };
}
