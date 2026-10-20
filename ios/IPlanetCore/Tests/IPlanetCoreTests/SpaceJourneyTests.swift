import XCTest
@testable import IPlanetCore

final class SpaceJourneyTests: XCTestCase {
    func testConditionFollowsHealth() {
        XCTAssertEqual(SpaceCondition.from(.onTrack), .calm)
        XCTAssertEqual(SpaceCondition.from(.done), .calm)
        XCTAssertEqual(SpaceCondition.from(.nearLate), .asteroidField)
        XCTAssertEqual(SpaceCondition.from(.late), .meteorStorm)
        XCTAssertEqual(SpaceCondition.meteorStorm.label, "Chuva de meteoros")
    }

    func testPaceSlowsWithHealth() {
        XCTAssertGreaterThan(RocketMotionProfile.from(.onTrack).pace, RocketMotionProfile.from(.nearLate).pace)
        XCTAssertGreaterThan(RocketMotionProfile.from(.nearLate).pace, RocketMotionProfile.from(.late).pace)
        XCTAssertEqual(RocketMotionProfile.from(.late).turbulence, 1)
    }

    func testMotionCruisesThenStopsAtTarget() {
        let p = RocketMotionProfile.from(.onTrack)
        let a = p.sample(target: 0.5, elapsed: 0.5), b = p.sample(target: 0.5, elapsed: 1.0)
        XCTAssertEqual(a.speed, b.speed, accuracy: 1e-9)
        XCTAssertEqual(b.progress, 2 * a.progress, accuracy: 1e-9)
        let end = p.sample(target: 0.5, elapsed: 10)
        XCTAssertEqual(end.progress, 0.5)
        XCTAssertEqual(end.flame, 0)
        XCTAssertEqual(p.sample(target: 0, elapsed: 1).progress, 0)
    }

    func testRouteRunsEarthToPlanet() {
        let r = RocketRoute()
        XCTAssertEqual(r.point(at: 0).x, RocketRoute.earth.x, accuracy: 0.01)
        XCTAssertEqual(r.point(at: 1).y, RocketRoute.planet.y, accuracy: 0.01)
        XCTAssertEqual(r.stations(count: 5).count, 4)
        XCTAssertTrue(r.stations(count: 1).isEmpty)
    }

    func testNebulaByHour() {
        XCTAssertNotEqual(NebulaTint.colors(hour: 12).top, NebulaTint.colors(hour: 2).top)
        XCTAssertEqual(NebulaTint.colors(hour: 18).glow, NebulaTint.colors(hour: 19).glow)
    }
}
