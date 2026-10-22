import Foundation

/// "Fazer aporte" da meta (espelho de src/lib/goals/aporte-prefill.ts).
public enum GoalAporte {
    public static let minimumCents = 500

    /// Parcela definida na meta, limitada ao que falta e nunca abaixo do mínimo
    /// (a não ser que falte menos que o mínimo). 0 = sem sugestão.
    public static func prefillCents(installmentCents: Int?, remainingCents: Int? = nil, minimumCents: Int = minimumCents) -> Int {
        guard let installment = installmentCents, installment > 0 else { return 0 }
        var cents = max(installment, minimumCents)
        if let remaining = remainingCents {
            if remaining <= 0 { return 0 }
            cents = min(cents, remaining)
        }
        return cents
    }

    /// Texto do campo "Valor em reais" (ex.: "703,84"); nil = deixa o campo vazio.
    public static func amountText(prefillCents: Int?, remainingCents: Int) -> String? {
        let cents = Self.prefillCents(installmentCents: prefillCents, remainingCents: remainingCents)
        guard cents > 0 else { return nil }
        return String(format: "%d,%02d", cents / 100, cents % 100)
    }

    /// Só os aportes da reserva da meta contam para o progresso dela.
    public static func contributions<T>(_ items: [T], reservationId: UUID?, reservation: (T) -> UUID?) -> [T] {
        guard let reservationId else { return [] }
        return items.filter { reservation($0) == reservationId }
    }
}
