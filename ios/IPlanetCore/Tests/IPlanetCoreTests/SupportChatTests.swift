import XCTest
@testable import IPlanetCore

final class SupportChatTests: XCTestCase {
    func testParsesEvents() {
        XCTAssertEqual(SupportSSE.parse(line: #"data: {"type":"delta","text":"Na reserva, "}"#), .delta("Na reserva, "))
        XCTAssertEqual(SupportSSE.parse(line: #"data:{"type":"done"}"#), .done)
        XCTAssertEqual(SupportSSE.parse(line: #"data: {"type":"error","error":"caiu"}"#), .error("caiu"))
        XCTAssertNil(SupportSSE.parse(line: ""))
        XCTAssertNil(SupportSSE.parse(line: ": ping"))
        XCTAssertNil(SupportSSE.parse(line: "data: não é json"))
        XCTAssertNil(SupportSSE.parse(line: #"data: {"type":"outro"}"#))
    }

    func testHistoryLimits() {
        var many = (0..<25).map { SupportMessage(role: $0 % 2 == 0 ? "user" : "assistant", content: "m\($0)") }
        many.append(SupportMessage(role: "system", content: "x"))
        many.append(SupportMessage(role: "user", content: String(repeating: "a", count: 2500)))
        let out = SupportHistory.prepare(many)
        XCTAssertEqual(out.count, 20)
        XCTAssertEqual(out.last?.content.count, 2000)
        XCTAssertFalse(out.contains { $0.role == "system" })
    }

    func testWhatsapp() {
        XCTAssertEqual(SupportHistory.whatsappURL("55 11 99999-9999")?.absoluteString, "https://wa.me/5511999999999")
        XCTAssertNil(SupportHistory.whatsappURL(nil))
    }
}
