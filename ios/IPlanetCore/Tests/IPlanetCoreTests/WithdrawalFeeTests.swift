import XCTest
@testable import IPlanetCore

final class WithdrawalFeeTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    func daysAgo(_ d: Double) -> Date { now.addingTimeInterval(-d * 86_400) }

    func testSplitsByTheSevenDayWindow() {
        let b = WithdrawalFee.breakdown(aportes: [
            .init(amountCents: 100_000, confirmedAt: daysAgo(30)),
            .init(amountCents: 50_000, confirmedAt: daysAgo(8)),
            .init(amountCents: 20_000, confirmedAt: daysAgo(2)),
        ], requestedAt: now)
        XCTAssertEqual(b.totalCents, 170_000)
        XCTAssertEqual(b.discountedCents, 150_000)
        XCTAssertEqual(b.fullRefundCents, 20_000)
        XCTAssertEqual(b.feeCents, 45_000)
        XCTAssertEqual(b.netCents, 125_000)
    }

    func testExactlySevenDaysIsStillFullRefund() {
        let b = WithdrawalFee.breakdown(aportes: [.init(amountCents: 10_000, confirmedAt: daysAgo(7))], requestedAt: now)
        XCTAssertEqual(b.feeCents, 0)
        XCTAssertEqual(b.netCents, 10_000)
        let older = WithdrawalFee.breakdown(aportes: [.init(amountCents: 10_000, confirmedAt: daysAgo(7.001))], requestedAt: now)
        XCTAssertEqual(older.feeCents, 3_000)
    }

    func testAllRecentMeansNoFee() {
        let b = WithdrawalFee.breakdown(aportes: [.init(amountCents: 99_999, confirmedAt: daysAgo(1))], requestedAt: now)
        XCTAssertEqual(b.feeCents, 0)
        XCTAssertEqual(b.netCents, 99_999)
    }

    func testCustomRateAndRounding() {
        let b = WithdrawalFee.breakdown(aportes: [.init(amountCents: 333, confirmedAt: daysAgo(10))], requestedAt: now, feePercent: 25)
        XCTAssertEqual(b.feeCents, 83) // 83,25 → 83
        let half = WithdrawalFee.breakdown(aportes: [.init(amountCents: 50, confirmedAt: daysAgo(10))], requestedAt: now, feePercent: 33)
        XCTAssertEqual(half.feeCents, 17) // 16,5 → 17 (Math.round)
        XCTAssertEqual(WithdrawalFee.percent(fromSetting: "25"), 25)
        XCTAssertEqual(WithdrawalFee.percent(fromSetting: "abc"), 30)
        XCTAssertEqual(WithdrawalFee.percentLabel(12.5), "12,5")
        XCTAssertEqual(WithdrawalFee.percentLabel(30), "30")
    }
}
