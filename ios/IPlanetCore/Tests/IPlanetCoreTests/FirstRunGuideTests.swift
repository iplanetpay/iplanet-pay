import XCTest
@testable import IPlanetCore

final class FirstRunGuideTests: XCTestCase {
    func testStepsFollowRealProgress() {
        XCTAssertEqual(FirstRunGuide.step(GuideFacts()), .chooseProduct)
        XCTAssertEqual(FirstRunGuide.step(GuideFacts(viewedProduct: true)), .createReservation)
        XCTAssertEqual(FirstRunGuide.step(GuideFacts(hasReservation: true)), .createGoal)
        XCTAssertEqual(FirstRunGuide.step(GuideFacts(hasReservation: true, goalSkipped: true)), .generatePix)
        XCTAssertEqual(FirstRunGuide.step(GuideFacts(hasReservation: true, hasGoal: true)), .generatePix)
        XCTAssertEqual(FirstRunGuide.step(GuideFacts(hasReservation: true, hasPendingPix: true)), .confirmPayment)
        XCTAssertEqual(FirstRunGuide.step(GuideFacts(hasReservation: true, hasConfirmedContribution: true)), .done)
    }

    func testVisibility() {
        XCTAssertTrue(FirstRunGuide.shouldShow(facts: GuideFacts(), dismissed: false, completed: false))
        XCTAssertFalse(FirstRunGuide.shouldShow(facts: GuideFacts(), dismissed: true, completed: false))
        XCTAssertFalse(FirstRunGuide.shouldShow(facts: GuideFacts(hasConfirmedContribution: true), dismissed: false, completed: false))
        XCTAssertEqual(FirstRunGuide.progress(.done), 1)
        XCTAssertEqual(FirstRunGuide.progress(.chooseProduct), 0)
        XCTAssertEqual(FirstRunGuide.defaultsKey(userId: "ABC", "skip"), "iplanet.guide.abc.skip")
    }
}
