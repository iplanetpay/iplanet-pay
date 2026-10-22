import Foundation

/// Dupla confirmação do "Cancelar reserva" (espelha src/lib/reservations/cancel-confirm.ts).
/// idle -> warn (1ª confirmação) -> final (2ª, destrutiva) -> submitting. Só `final + confirm` chama a API.
public enum CancelConfirm {
    public enum Step: Equatable { case idle, warn, final, submitting }
    public enum Action { case open, `continue`, confirm, dismiss, failed, done }

    public static func next(_ step: Step, _ action: Action) -> Step {
        switch action {
        case .open: return step == .idle ? .warn : step
        case .continue: return step == .warn ? .final : step
        case .confirm: return step == .final ? .submitting : step
        case .dismiss: return step == .submitting ? step : .idle
        case .failed, .done: return step == .submitting ? .idle : step
        }
    }

    public static func shouldSubmit(_ step: Step, _ action: Action) -> Bool {
        step == .final && action == .confirm
    }

    public static let warnTitle = "Cancelar esta reserva?"
    public static let warnWithAportes = "Os aportes confirmados vão para a sua carteira e podem ser usados em outro aparelho ou sacados. Pela cláusula 11 dos Termos, aportes confirmados há 7 dias ou menos voltam integralmente; sobre os confirmados há mais de 7 dias é descontada a taxa administrativa no saque."
    public static let warnNoAportes = "Você perde a reserva deste aparelho e a posição na fila."
    public static let keep = "Manter reserva"
    public static let continueLabel = "Continuar"
    public static let finalTitle = "Tem certeza?"
    public static let finalBody = "Esta ação não pode ser desfeita. A reserva será cancelada definitivamente."
    public static let back = "Voltar"
    public static let confirm = "Sim, cancelar definitivamente"
    public static let submitting = "Cancelando..."
}
