import XCTest
@testable import IPlanetCore

final class GoalAporteTests: XCTestCase {
    func testPrefillUsesGoalInstallment() {
        XCTAssertEqual(GoalAporte.prefillCents(installmentCents: 70384), 70384)
        XCTAssertEqual(GoalAporte.amountText(prefillCents: 70384, remainingCents: 915000), "703,84")
    }

    func testPrefillCapsAtRemainingAndMinimum() {
        XCTAssertEqual(GoalAporte.prefillCents(installmentCents: 70384, remainingCents: 20000), 20000)
        XCTAssertEqual(GoalAporte.prefillCents(installmentCents: 100, remainingCents: 20000), 500)
        XCTAssertEqual(GoalAporte.prefillCents(installmentCents: 0), 0)
        XCTAssertNil(GoalAporte.amountText(prefillCents: nil, remainingCents: 1000))
        XCTAssertNil(GoalAporte.amountText(prefillCents: 70384, remainingCents: 0))
    }

    func testOnlyTheGoalsReservationCounts() {
        let a = UUID(), b = UUID()
        let rows: [(UUID, Int)] = [(a, 70384), (b, 1_199_900), (a, 100_000)]
        let own = GoalAporte.contributions(rows, reservationId: a) { $0.0 }
        XCTAssertEqual(own.map { $0.1 }, [70384, 100_000])
        XCTAssertTrue(GoalAporte.contributions(rows, reservationId: nil) { $0.0 }.isEmpty)
    }
}
