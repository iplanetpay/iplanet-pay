import Foundation

public enum RopeMark: String, Sendable {
    case upcoming
    case onTime = "on_time"
    case late
}

public struct TrailPoint: Equatable, Sendable {
    public var x: Double
    public var y: Double
}

public enum SupplyId: String, Sendable, CaseIterable {
    case mochila, corda, casaco, comida, lanterna
}

public enum DayPhase: String, Sendable { case day, night }

public enum ExternalWeather: String, Sendable { case clear, wind, rain, snow, storm }

public enum WeatherKind: String, Sendable { case clear, calm, wind, rain, snow, storm }

public enum ClimbMotion: String, Sendable { case confident, slow, slip, celebrate }

public struct JourneyWeather: Equatable, Sendable {
    public var kind: WeatherKind
    public var density: Int
    public var phase: DayPhase
}

public enum ClimbJourney {
    private static let trail: [(Double, Double)] = [
        (96, 332), (168, 286), (246, 240), (318, 196), (392, 152), (468, 108), (528, 68),
    ]

    public static func ropeMark(_ status: InstallmentStatus) -> RopeMark {
        switch status {
        case .upcoming: .upcoming
        case .onTime: .onTime
        case .latePayment, .missed: .late
        }
    }

    public static func trailPoint(_ progress: Double) -> TrailPoint {
        let clamped = max(0, min(1, progress))
        let segments = trail.count - 1
        let scaled = clamped * Double(segments)
        let index = min(segments - 1, Int(floor(scaled)))
        let local = segments == 0 ? 0 : scaled - Double(index)
        let start = trail[index]
        let end = trail[min(trail.count - 1, index + 1)]
        return TrailPoint(x: start.0 + (end.0 - start.0) * local, y: start.1 + (end.1 - start.1) * local)
    }

    public static func ropePoints(_ count: Int) -> [TrailPoint] {
        if count <= 0 { return [] }
        if count == 1 { return [trailPoint(1)] }
        return (0..<count).map { index in trailPoint(Double(index) / Double(count - 1)) }
    }

    public static func dayPhase(_ hour: Int) -> DayPhase {
        let normalized = ((hour % 24) + 24) % 24
        return normalized >= 6 && normalized < 18 ? .day : .night
    }

    public static func supplies(health: GoalHealth, progressPercent: Double) -> [SupplyId] {
        switch health {
        case .late, .nearLate:
            return []
        case .complete:
            return SupplyId.allCases
        case .onTrack:
            let progress = max(0, min(100, progressPercent.isFinite ? progressPercent : 0))
            let count = progress >= 80 ? 5 : progress >= 60 ? 4 : progress >= 40 ? 3 : progress >= 20 ? 2 : 1
            return Array(SupplyId.allCases.prefix(count))
        }
    }

    public static func mapOpenWeather(code: Int, windSpeed: Double) -> ExternalWeather {
        if code >= 200 && code < 300 { return .storm }
        if code >= 600 && code < 700 { return .snow }
        if (code >= 300 && code < 400) || (code >= 500 && code < 600) { return .rain }
        if code >= 700 && code < 800 { return .wind }
        if windSpeed >= 10 { return .wind }
        return .clear
    }

    public static func journeyWeather(health: GoalHealth, hour: Int, external: ExternalWeather?) -> JourneyWeather {
        let phase = dayPhase(hour)
        switch health {
        case .late:
            return JourneyWeather(kind: .storm, density: 3, phase: phase)
        case .nearLate:
            return JourneyWeather(kind: worsened(phase, external), density: 2, phase: phase)
        case .onTrack, .complete:
            return JourneyWeather(kind: pleasant(phase, external), density: 1, phase: phase)
        }
    }

    public static func climbMotion(_ health: GoalHealth) -> ClimbMotion {
        switch health {
        case .onTrack: .confident
        case .nearLate: .slow
        case .late: .slip
        case .complete: .celebrate
        }
    }

    private static func pleasant(_ phase: DayPhase, _ external: ExternalWeather?) -> WeatherKind {
        switch external ?? .clear {
        case .clear: phase == .day ? .clear : .calm
        case .wind: .wind
        case .rain: .rain
        case .snow: .snow
        case .storm: .storm
        }
    }

    private static func worsened(_ phase: DayPhase, _ external: ExternalWeather?) -> WeatherKind {
        switch external ?? .clear {
        case .clear: phase == .day ? .rain : .wind
        case .wind: .wind
        case .rain: .rain
        case .snow: .snow
        case .storm: .storm
        }
    }
}

public enum DepositStatus: String, Sendable {
    case paidOnTime = "paid_on_time"
    case paidLate = "paid_late"
    case missed
    case pending
}

public struct ClimbDeposit: Sendable {
    public var status: DepositStatus
    public var dueDate: String
    public init(status: DepositStatus, dueDate: String) {
        self.status = status
        self.dueDate = dueDate
    }
}

public enum ClimbStatus: String, Sendable {
    case onTrack = "on_track"
    case nearLate = "near_late"
    case late
    case done

    public var label: String {
        switch self {
        case .onTrack: "Em dia"
        case .nearLate: "Quase atrasada"
        case .late: "Atrasada"
        case .done: "Conquistada"
        }
    }

    public var message: String {
        switch self {
        case .onTrack: "Você está em dia. Continue assim."
        case .nearLate: "O próximo aporte vence logo."
        case .late: "Faça o aporte para voltar ao ritmo."
        case .done: "Você conquistou a meta. Parabéns!"
        }
    }
}

public enum ClimbLogic {
    public static func deriveStatus(deposits: [ClimbDeposit], percent: Double, today: String) -> ClimbStatus {
        if percent >= 100 { return .done }
        if deposits.contains(where: { $0.status == .missed || ($0.status == .pending && $0.dueDate < today) }) {
            return .late
        }
        if let next = deposits.first(where: { $0.status == .pending }),
           let tomorrow = try? CivilDate.addDays(today, 1),
           next.dueDate <= tomorrow {
            return .nearLate
        }
        return .onTrack
    }

    public static func relativeDue(_ iso: String, today: String) -> String {
        let days = isoDayDelta(today, iso)
        if days == 0 { return "hoje" }
        if days == 1 { return "amanhã" }
        if days > 1 { return "em \(days) dias" }
        if days == -1 { return "atrasado há 1 dia" }
        return "atrasado há \(-days) dias"
    }

    public static func climbStreak(_ deposits: [DepositStatus]) -> Int {
        var streak = 0
        for status in deposits {
            switch status {
            case .paidOnTime: streak += 1
            case .paidLate, .missed: streak = 0
            case .pending: return streak
            }
        }
        return streak
    }

    public static func climbDaysLate(today: String, deposits: [ClimbDeposit]) -> Int {
        let overdue = deposits
            .filter { $0.status == .missed || ($0.status == .pending && $0.dueDate < today) }
            .map(\.dueDate)
            .sorted()
        guard let earliest = overdue.first else { return 0 }
        return max(1, isoDayDelta(earliest, today))
    }

    public static func isoDayDelta(_ from: String, _ to: String) -> Int {
        guard let start = CivilDate.parse(from), let end = CivilDate.parse(to) else { return 0 }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        func date(_ parts: (year: Int, month: Int, day: Int)) -> Date? {
            var comps = DateComponents()
            comps.calendar = calendar
            comps.timeZone = TimeZone(secondsFromGMT: 0)
            comps.year = parts.year
            comps.month = parts.month
            comps.day = parts.day
            return calendar.date(from: comps)
        }
        guard let fromDate = date(start), let toDate = date(end) else { return 0 }
        return Int((toDate.timeIntervalSince(fromDate) / 86_400).rounded())
    }
}
