import Foundation

/// Espelho de `src/lib/trade-in/offer-state.ts`: crédito de aparelho usado avaliado.
public enum TradeInCredit {
    public static let validDays = 90
    /// Mesmos hex do site (`TRADE_IN_YELLOW` / `TRADE_IN_EXPIRED_RED`).
    public static let yellowHex: UInt32 = 0xE0A100
    public static let expiredRedHex: UInt32 = 0xE11D48

    public struct Offer: Sendable, Equatable {
        public var status: String
        public var adminMessage: String?
        public var approvedValueCents: Int?
        public var reviewedAt: Date?
        public init(status: String, adminMessage: String?, approvedValueCents: Int?, reviewedAt: Date?) {
            self.status = status
            self.adminMessage = adminMessage
            self.approvedValueCents = approvedValueCents
            self.reviewedAt = reviewedAt
        }
        public var isDiscarded: Bool { (adminMessage ?? "").hasPrefix("DESCARTADA|") }
        public var isMarkedExpired: Bool { (adminMessage ?? "").hasPrefix("EXPIRADA|") }
    }

    public struct Summary: Sendable, Equatable {
        public var activeCents = 0
        public var expiredCents = 0
        public var inPaidCents = 0
        public var acceptedCount = 0
    }

    public static func expiresAt(_ offer: Offer) -> Date? {
        guard offer.status == "approved", let reviewed = offer.reviewedAt, !offer.isDiscarded else { return nil }
        return reviewed.addingTimeInterval(Double(validDays) * 86_400)
    }

    public static func daysRemaining(_ offer: Offer, now: Date = Date()) -> Int? {
        guard let expires = expiresAt(offer) else { return nil }
        return max(0, Int((expires.timeIntervalSince(now) / 86_400).rounded(.up)))
    }

    /// (crédito, expirado, descartado) — igual a `tradeInVisual`.
    public static func visual(_ offer: Offer, now: Date = Date()) -> (creditCents: Int, expired: Bool, discarded: Bool) {
        guard offer.status == "approved", let value = offer.approvedValueCents, value > 0 else { return (0, false, false) }
        if offer.isDiscarded { return (0, false, true) }
        let past = expiresAt(offer).map { $0 <= now } ?? false
        return (value, offer.isMarkedExpired || past, false)
    }

    public static func summary(_ offers: [Offer], now: Date = Date()) -> Summary {
        var s = Summary()
        for offer in offers {
            let v = visual(offer, now: now)
            if v.discarded || v.creditCents <= 0 { continue }
            if !offer.isMarkedExpired { s.inPaidCents += v.creditCents }
            if v.expired {
                s.expiredCents += v.creditCents
            } else {
                s.activeCents += v.creditCents
                s.acceptedCount += 1
            }
        }
        return s
    }

    /// Parte em dinheiro de `amount_paid_cents` sem os créditos de usado.
    public static func cashCents(amountPaidCents: Int, offers: [Offer], now: Date = Date()) -> Int {
        max(0, amountPaidCents - summary(offers, now: now).inPaidCents)
    }

    /// Fatias do anel: azul (aportes) + amarelo (usado avaliado). Igual a `tradeInProgressSegments`.
    public static func segments(listPriceCents: Int, cashCents: Int, tradeCents: Int) -> (cashPct: Int, tradePct: Int) {
        guard listPriceCents > 0 else { return (0, 0) }
        func pct(_ v: Int) -> Int {
            max(0, min(100, Int((Double(v) / Double(listPriceCents) * 100).rounded(.toNearestOrAwayFromZero))))
        }
        let cash = pct(cashCents)
        return (cash, min(100 - cash, pct(tradeCents)))
    }
}
