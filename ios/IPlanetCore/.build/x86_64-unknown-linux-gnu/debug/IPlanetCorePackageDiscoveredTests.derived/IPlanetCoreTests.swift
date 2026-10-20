import XCTest
@testable import IPlanetCoreTests

fileprivate extension CoreTests {
    @available(*, deprecated, message: "Not actually deprecated. Marked as deprecated to allow inclusion of deprecated tests (which test deprecated functionality) without warnings")
    static nonisolated(unsafe) let __allTests__CoreTests = [
        ("testCalendarMarksAndGoalHealth", testCalendarMarksAndGoalHealth),
        ("testClimbRopeAndWeather", testClimbRopeAndWeather),
        ("testContributionPlanMatchesTheSite", testContributionPlanMatchesTheSite),
        ("testEarlyPaymentsReduceTheNextAporte", testEarlyPaymentsReduceTheNextAporte),
        ("testRaffleIdentityPhoneAndTradeIn", testRaffleIdentityPhoneAndTradeIn)
    ]
}
@available(*, deprecated, message: "Not actually deprecated. Marked as deprecated to allow inclusion of deprecated tests (which test deprecated functionality) without warnings")
func __IPlanetCoreTests__allTests() -> [XCTestCaseEntry] {
    return [
        testCase(CoreTests.__allTests__CoreTests)
    ]
}