import XCTest
@testable import IPlanetCore

final class PixConfirmationTests: XCTestCase {
    func testPendingToConfirmedTriggersSuccess() {
        XCTAssertTrue(PixConfirmation.triggersSuccess(previous: "pending", current: "confirmed"))
    }

    func testOtherTransitionsDoNotTrigger() {
        XCTAssertFalse(PixConfirmation.triggersSuccess(previous: "confirmed", current: "confirmed"))
        XCTAssertFalse(PixConfirmation.triggersSuccess(previous: "pending", current: "pending"))
        XCTAssertFalse(PixConfirmation.triggersSuccess(previous: "pending", current: "failed"))
        XCTAssertFalse(PixConfirmation.triggersSuccess(previous: nil, current: "confirmed"))
    }

    func testNewlyConfirmedPicksOnlyFlippedIds() {
        let ids = PixConfirmation.newlyConfirmed(
            before: [1: "pending", 2: "pending", 3: "confirmed"],
            after: [1: "confirmed", 2: "pending", 3: "confirmed", 4: "confirmed"])
        XCTAssertEqual(ids, [1])
    }

    /// Regressão: 403 (aporte de outra conta) escondia o botão como se a simulação estivesse desligada.
    func testOnlyNotFoundMeansSimulationDisabled() {
        XCTAssertTrue(PixConfirmation.simulationDisabled(httpStatus: 404))
        XCTAssertFalse(PixConfirmation.simulationDisabled(httpStatus: 403))
        XCTAssertFalse(PixConfirmation.simulationDisabled(httpStatus: 401))
        XCTAssertFalse(PixConfirmation.simulationDisabled(httpStatus: 200))
    }

    func testSimulatedSuccessClosesQuickly() {
        XCTAssertGreaterThan(PixConfirmation.simulatedAutoCloseSeconds, 0)
        XCTAssertLessThanOrEqual(PixConfirmation.simulatedAutoCloseSeconds, 2)
    }
}
