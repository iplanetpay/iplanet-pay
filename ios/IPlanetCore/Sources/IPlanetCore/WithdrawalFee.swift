import Foundation

/// Taxa de saque: só incide sobre aportes Pix confirmados há mais de 7 dias do pedido;
/// aportes dos últimos 7 dias voltam integralmente. Mesma taxa (admin, padrão 30%) para reserva e carteira.
public struct WithdrawalBreakdown: Equatable, Sendable {
    public var totalCents: Int
    /// Aportes dos últimos 7 dias: reembolso integral.
    public var fullRefundCents: Int
    /// Aportes confirmados há mais de 7 dias: base da taxa.
    public var discountedCents: Int
    public var feePercent: Double
    public var feeCents: Int
    public var netCents: Int
}

public enum WithdrawalFee {
    public static let defaultPercent: Double = 30
    public static let fullRefundWindow: TimeInterval = 7 * 24 * 60 * 60

    public struct Aporte: Sendable {
        public var amountCents: Int
        public var confirmedAt: Date
        public init(amountCents: Int, confirmedAt: Date) {
            self.amountCents = amountCents
            self.confirmedAt = confirmedAt
        }
    }

    /// Mesmo arredondamento do site (`Math.round(base * pct / 100)`).
    public static func breakdown(aportes: [Aporte], requestedAt: Date, feePercent: Double = defaultPercent) -> WithdrawalBreakdown {
        let pct = max(0, min(100, feePercent))
        let cutoff = requestedAt.addingTimeInterval(-fullRefundWindow)
        var full = 0, discounted = 0
        for aporte in aportes where aporte.amountCents > 0 {
            // "Mais de 7 dias antes do pedido" → com taxa; dentro da janela → integral.
            if aporte.confirmedAt < cutoff { discounted += aporte.amountCents } else { full += aporte.amountCents }
        }
        let fee = Int((Double(discounted) * pct / 100).rounded(.toNearestOrAwayFromZero))
        return WithdrawalBreakdown(
            totalCents: full + discounted,
            fullRefundCents: full,
            discountedCents: discounted,
            feePercent: pct,
            feeCents: fee,
            netCents: full + discounted - fee
        )
    }

    /// Lê o valor de `app_settings.withdrawal_fee_pct` ("30", "30.5"); inválido → 30.
    public static func percent(fromSetting value: String?) -> Double {
        guard let raw = value?.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "."),
              let v = Double(raw), v >= 0, v <= 100 else { return defaultPercent }
        return v
    }

    /// "30" ou "12,5".
    public static func percentLabel(_ pct: Double) -> String {
        pct.rounded() == pct ? String(Int(pct)) : String(format: "%.1f", pct).replacingOccurrences(of: ".", with: ",")
    }
}
