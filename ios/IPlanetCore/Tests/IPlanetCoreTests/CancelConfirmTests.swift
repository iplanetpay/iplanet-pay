import XCTest
@testable import IPlanetCore

final class CancelConfirmTests: XCTestCase {
    private func run(_ actions: [CancelConfirm.Action]) -> (CancelConfirm.Step, Int) {
        var step = CancelConfirm.Step.idle
        var calls = 0
        for a in actions {
            if CancelConfirm.shouldSubmit(step, a) { calls += 1 }
            step = CancelConfirm.next(step, a)
        }
        return (step, calls)
    }

    func testRequiresTwoConfirmationsBeforeSubmit() {
        XCTAssertEqual(run([.open]).1, 0)
        XCTAssertEqual(run([.open, .confirm]).1, 0)
        XCTAssertEqual(run([.open, .continue]).1, 0)
        let r = run([.open, .continue, .confirm])
        XCTAssertEqual(r.0, .submitting)
        XCTAssertEqual(r.1, 1)
    }

    func testDismissAndNoDoubleSubmit() {
        XCTAssertEqual(run([.open, .dismiss]).0, .idle)
        XCTAssertEqual(run([.open, .continue, .dismiss, .confirm]).1, 0)
        XCTAssertEqual(run([.open, .continue, .confirm, .confirm]).1, 1)
        XCTAssertEqual(run([.open, .continue, .confirm, .failed]).0, .idle)
    }
}
