import XCTest
@testable import IPlanetCore

final class TradeInCreditTests: XCTestCase {
    private let reviewed = ISO8601DateFormatter().date(from: "2026-10-01T00:00:00Z")!
    private let now = ISO8601DateFormatter().date(from: "2026-10-19T00:00:00Z")!

    private func approved(_ cents: Int, message: String? = nil, reviewedAt: Date? = nil) -> TradeInCredit.Offer {
        .init(status: "approved", adminMessage: message, approvedValueCents: cents, reviewedAt: reviewedAt ?? reviewed)
    }

    func testEvaluatedTradeInSplitsCashAndYellowCredit() {
        let offers = [approved(200_000), .init(status: "pending", adminMessage: nil, approvedValueCents: nil, reviewedAt: nil)]
        let summary = TradeInCredit.summary(offers, now: now)
        XCTAssertEqual(summary.activeCents, 200_000)
        XCTAssertEqual(TradeInCredit.cashCents(amountPaidCents: 500_000, offers: offers, now: now), 300_000)
        let seg = TradeInCredit.segments(listPriceCents: 1_000_000, cashCents: 300_000, tradeCents: summary.activeCents)
        XCTAssertEqual(seg.cashPct, 30)
        XCTAssertEqual(seg.tradePct, 20)
        XCTAssertEqual(TradeInCredit.yellowHex, 0xE0A100)
    }

    func testExpiredAndDiscardedCredits() {
        let old = ISO8601DateFormatter().date(from: "2026-06-01T00:00:00Z")!
        let offers = [approved(100_000, reviewedAt: old), approved(50_000, message: "EXPIRADA|x"), approved(70_000, message: "DESCARTADA|x")]
        let s = TradeInCredit.summary(offers, now: now)
        XCTAssertEqual(s.activeCents, 0)
        XCTAssertEqual(s.expiredCents, 150_000)
        XCTAssertEqual(s.inPaidCents, 100_000)
        XCTAssertEqual(TradeInCredit.daysRemaining(approved(1), now: now), 72)
    }

    func testSegmentsNeverExceedHundred() {
        let seg = TradeInCredit.segments(listPriceCents: 1_000_000, cashCents: 900_000, tradeCents: 300_000)
        XCTAssertEqual(seg.cashPct + seg.tradePct, 100)
        XCTAssertEqual(TradeInCredit.segments(listPriceCents: 0, cashCents: 1, tradeCents: 1).cashPct, 0)
    }
}
