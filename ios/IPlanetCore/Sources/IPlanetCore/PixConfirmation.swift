import Foundation

/// Transição de status de um aporte Pix: só `pending -> confirmed` dispara o fluxo de sucesso
/// (saldo, meta, foguete). Usado pela confirmação automática e pelo botão "Pago (teste)".
public enum PixConfirmation {
    /// Tempo que o sucesso do "Pago (teste)" fica visível antes de a folha fechar sozinha.
    public static let simulatedAutoCloseSeconds: Double = 1.2

    /// Só 404 significa "simulação desligada no servidor"; 401/403 são erros a mostrar.
    public static func simulationDisabled(httpStatus: Int) -> Bool { httpStatus == 404 }

    public static func triggersSuccess(previous: String?, current: String?) -> Bool {
        previous == "pending" && current == "confirmed"
    }

    /// Ids que estavam pendentes e agora estão confirmados.
    public static func newlyConfirmed<ID: Hashable>(before: [ID: String], after: [ID: String]) -> Set<ID> {
        Set(after.compactMap { id, status in triggersSuccess(previous: before[id], current: status) ? id : nil })
    }
}
