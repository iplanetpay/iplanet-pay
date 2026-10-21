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
        XCTAssertEqual(b.windowDays, 7)
    }

    func testBoundaryAndMissingDateFavorTheClient() {
        XCTAssertEqual(WithdrawalFee.breakdown(aportes: [.init(amountCents: 10_000, confirmedAt: daysAgo(7))], requestedAt: now).feeCents, 0)
        XCTAssertEqual(WithdrawalFee.breakdown(aportes: [.init(amountCents: 10_000, confirmedAt: daysAgo(7.001))], requestedAt: now).feeCents, 3_000)
        XCTAssertEqual(WithdrawalFee.breakdown(aportes: [.init(amountCents: 10_000, confirmedAt: nil)], requestedAt: now).fullRefundCents, 10_000)
    }

    func testCustomWindowRateAndAmountCap() {
        let b = WithdrawalFee.breakdown(aportes: [
            .init(amountCents: 30_000, confirmedAt: daysAgo(2)),
            .init(amountCents: 70_000, confirmedAt: daysAgo(20)),
        ], requestedAt: now, feePercent: 25, windowDays: 3, amountCents: 50_000)
        XCTAssertEqual(b.totalCents, 50_000)
        XCTAssertEqual(b.fullRefundCents, 30_000)
        XCTAssertEqual(b.discountedCents, 20_000)
        XCTAssertEqual(b.feeCents, 5_000)
    }

    func testRoundingConfigAndServerRows() {
        XCTAssertEqual(WithdrawalFee.breakdown(aportes: [.init(amountCents: 50, confirmedAt: daysAgo(10))], requestedAt: now, feePercent: 33).feeCents, 17)
        let cfg = WithdrawalFee.config(feeSetting: "25", windowSetting: "10")
        XCTAssertEqual(cfg.feePct, 25)
        XCTAssertEqual(cfg.windowDays, 10)
        let bad = WithdrawalFee.config(feeSetting: "abc", windowSetting: nil)
        XCTAssertEqual(bad.feePct, 30)
        XCTAssertEqual(bad.windowDays, 7)
        XCTAssertEqual(WithdrawalFee.percentLabel(12.5), "12.5")
        let legacy = WithdrawalBreakdown.fromServer(totalPaidCents: 100_000, feePct: 30, feeAmountCents: 30_000, refundAmountCents: 70_000, fullRefundCents: nil, discountedCents: nil)
        XCTAssertEqual(legacy.discountedCents, 100_000)
        XCTAssertEqual(legacy.fullRefundCents, 0)
    }
}
