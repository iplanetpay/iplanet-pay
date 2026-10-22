import Foundation

/// Transição de status de um aporte Pix: só `pending -> confirmed` dispara o fluxo de sucesso
/// (saldo, meta, foguete). Usado pela confirmação automática e pelo botão "Pago (teste)".
public enum PixConfirmation {
    public static func triggersSuccess(previous: String?, current: String?) -> Bool {
        previous == "pending" && current == "confirmed"
    }

    /// Ids que estavam pendentes e agora estão confirmados.
    public static func newlyConfirmed<ID: Hashable>(before: [ID: String], after: [ID: String]) -> Set<ID> {
        Set(after.compactMap { id, status in triggersSuccess(previous: before[id], current: status) ? id : nil })
    }
}
