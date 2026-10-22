/**
 * Dupla confirmação do "Cancelar reserva" (site e app).
 * Fluxo: idle -> warn (1ª confirmação, explica o que acontece com os aportes)
 *        -> final (2ª confirmação, botão destrutivo definitivo) -> submitting.
 * Só o estado `final` pode disparar a chamada à API.
 */
export type CancelConfirmStep = "idle" | "warn" | "final" | "submitting";

export type CancelConfirmAction = "open" | "continue" | "confirm" | "dismiss" | "failed" | "done";

export function nextCancelStep(step: CancelConfirmStep, action: CancelConfirmAction): CancelConfirmStep {
  switch (action) {
    case "open":
      return step === "idle" ? "warn" : step;
    case "continue":
      return step === "warn" ? "final" : step;
    case "confirm":
      return step === "final" ? "submitting" : step;
    case "dismiss":
      return step === "submitting" ? step : "idle";
    case "failed":
    case "done":
      return step === "submitting" ? "idle" : step;
  }
}

/** A API só pode ser chamada na transição final -> submitting. */
export function cancelShouldSubmit(step: CancelConfirmStep, action: CancelConfirmAction): boolean {
  return step === "final" && action === "confirm";
}

export const CANCEL_COPY = {
  warnTitle: "Cancelar esta reserva?",
  warnWithAportes:
    "Os aportes confirmados vão para a sua carteira e podem ser usados em outro aparelho ou sacados. Pela cláusula 11 dos Termos, aportes confirmados há 7 dias ou menos voltam integralmente; sobre os confirmados há mais de 7 dias é descontada a taxa administrativa no saque.",
  warnNoAportes: "Você perde a reserva deste aparelho e a posição na fila.",
  keep: "Manter reserva",
  continue: "Continuar",
  finalTitle: "Tem certeza?",
  finalBody: "Esta ação não pode ser desfeita. A reserva será cancelada definitivamente.",
  back: "Voltar",
  confirm: "Sim, cancelar definitivamente",
  submitting: "Cancelando...",
} as const;
