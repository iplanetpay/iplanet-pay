import Foundation

/// Quebra do saque (Termos platform-v4, cláusula 11). Espelha `splitWithdrawal`
/// (src/lib/withdrawals/fee-window.ts) e a RPC `request_withdrawal` da migration 037.
public struct WithdrawalBreakdown: Equatable, Sendable, Decodable {
    public var totalCents: Int
    /// Parte devolvida sem desconto (dentro da janela).
    public var fullRefundCents: Int
    /// Parte sobre a qual a taxa incide (fora da janela).
    public var discountedCents: Int
    public var feePct: Double
    public var feeCents: Int
    public var netCents: Int
    public var windowDays: Int

    public init(totalCents: Int, fullRefundCents: Int, discountedCents: Int, feePct: Double, feeCents: Int, netCents: Int, windowDays: Int) {
        self.totalCents = totalCents
        self.fullRefundCents = fullRefundCents
        self.discountedCents = discountedCents
        self.feePct = feePct
        self.feeCents = feeCents
        self.netCents = netCents
        self.windowDays = windowDays
    }

    /// Valores gravados em `withdrawal_requests`. Sem `full_refund_cents` (registro antigo) = tudo com desconto.
    public static func fromServer(totalPaidCents: Int, feePct: Double?, feeAmountCents: Int, refundAmountCents: Int,
                                  fullRefundCents: Int?, discountedCents: Int?, windowDays: Int = WithdrawalFee.defaultWindowDays) -> WithdrawalBreakdown {
        let full = max(0, fullRefundCents ?? 0)
        let discounted = max(0, discountedCents ?? totalPaidCents - full)
        return WithdrawalBreakdown(totalCents: totalPaidCents, fullRefundCents: full, discountedCents: discounted,
                                   feePct: feePct ?? WithdrawalFee.defaultPercent, feeCents: feeAmountCents,
                                   netCents: refundAmountCents, windowDays: windowDays)
    }
}

public enum WithdrawalFee {
    public static let defaultPercent: Double = 30
    public static let defaultWindowDays = 7
    private static let dayMs = 24.0 * 60 * 60 * 1000

    public struct Aporte: Sendable {
        public var amountCents: Int
        /// `confirmed_at`, senão `created_at`.
        public var confirmedAt: Date?
        public init(amountCents: Int, confirmedAt: Date?) {
            self.amountCents = amountCents
            self.confirmedAt = confirmedAt
        }
    }

    /// Sem data: em favor do cliente (integral). Até `windowDays` dias (inclusive) → integral.
    public static func isWithinFullRefundWindow(_ confirmedAt: Date?, requestedAt: Date, windowDays: Int = defaultWindowDays) -> Bool {
        guard let confirmedAt else { return true }
        let diffMs = (requestedAt.timeIntervalSince1970 - confirmedAt.timeIntervalSince1970) * 1000
        return diffMs <= Double(windowDays) * dayMs
    }

    /// Mesmo arredondamento do site (`Math.round`). `amountCents` omitido = soma dos itens.
    public static func breakdown(aportes: [Aporte], requestedAt: Date = Date(), feePercent: Double = defaultPercent,
                                 windowDays: Int = defaultWindowDays, amountCents: Int? = nil) -> WithdrawalBreakdown {
        var sum = 0, recent = 0
        for item in aportes {
            let cents = max(0, item.amountCents)
            sum += cents
            if isWithinFullRefundWindow(item.confirmedAt, requestedAt: requestedAt, windowDays: windowDays) { recent += cents }
        }
        let total = max(0, amountCents ?? sum)
        let full = min(total, recent)
        let discounted = total - full
        let pct = feePercent.isFinite ? feePercent : defaultPercent
        let fee = jsRound(Double(discounted) * pct / 100)
        return WithdrawalBreakdown(totalCents: total, fullRefundCents: full, discountedCents: discounted,
                                   feePct: pct, feeCents: fee, netCents: total - fee, windowDays: windowDays)
    }

    /// `Math.round` do JavaScript (meio arredonda para cima).
    static func jsRound(_ x: Double) -> Int { Int((x + 0.5).rounded(.down)) }

    /// `parseFeeConfig`: app_settings.withdrawal_fee_pct / withdrawal_full_refund_days.
    public static func config(feeSetting: String?, windowSetting: String?) -> (feePct: Double, windowDays: Int) {
        let pct = feeSetting.flatMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        let days = windowSetting.flatMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        return (
            pct.map { $0 >= 0 && $0 <= 100 ? $0 : defaultPercent } ?? defaultPercent,
            days.map { $0 >= 0 ? Int($0.rounded()) : defaultWindowDays } ?? defaultWindowDays
        )
    }

    /// "30" ou "12.5", como `${feePct}` no site.
    public static func percentLabel(_ pct: Double) -> String {
        pct.rounded() == pct ? String(Int(pct)) : String(pct)
    }
}
