import Foundation

public enum InstallmentStatus: String, Codable, Sendable {
    case onTime = "on_time"
    case latePayment = "late_payment"
    case missed
    case upcoming

    public var label: String {
        switch self {
        case .onTime: "Aportado no prazo"
        case .latePayment: "Aportado atrasado"
        case .missed: "Não aportado"
        case .upcoming: "A aportar"
        }
    }
}

public enum CalendarMark: String, Codable, Sendable, CaseIterable {
    case due
    case onTime = "on_time"
    case lateDue = "late_due"
    case latePaid = "late_paid"
    case missed
    case upcoming
}

public struct InstallmentResolution: Equatable, Sendable {
    public var dueDate: String
    public var status: InstallmentStatus
    public var paidOn: String?
    public var missedDays: [String]
}

public struct MarkedDay: Equatable, Sendable {
    public var date: String
    public var marks: [CalendarMark]
}

public enum GoalHealth: String, Codable, Sendable {
    case onTrack = "on_track"
    case nearLate = "near_late"
    case late
    case complete

    public var label: String {
        switch self {
        case .onTrack: "Em dia"
        case .nearLate: "Perto de atrasar"
        case .late: "Atrasada"
        case .complete: "Concluída"
        }
    }
}

public enum GoalCalendarMath {
    public static func resolveSlots(
        dates: [String],
        today: String,
        contributions: [PlanContribution]
    ) -> [InstallmentResolution] {
        var pool = contributions
            .filter { $0.amountCents > 0 && $0.paidOn <= today && $0.paidOn.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil }
            .sorted { $0.paidOn < $1.paidOn }
            .map { (paidOn: $0.paidOn, used: false) }
        var resolutions: [InstallmentResolution] = []
        for index in dates.indices {
            let date = dates[index]
            let previous = index > 0 ? dates[index - 1] : ""
            let next = index + 1 < dates.count ? dates[index + 1] : nil
            if let found = pool.firstIndex(where: { !$0.used && $0.paidOn > previous && $0.paidOn <= date }) {
                pool[found].used = true
                resolutions.append(InstallmentResolution(dueDate: date, status: .onTime, paidOn: pool[found].paidOn, missedDays: []))
                continue
            }
            if date >= today {
                resolutions.append(InstallmentResolution(dueDate: date, status: .upcoming, paidOn: nil, missedDays: []))
                continue
            }
            if let found = pool.firstIndex(where: { item in
                if item.used { return false }
                if item.paidOn <= date || item.paidOn > today { return false }
                if let next, item.paidOn >= next { return false }
                return true
            }) {
                pool[found].used = true
                let paidOn = pool[found].paidOn
                resolutions.append(InstallmentResolution(
                    dueDate: date,
                    status: .latePayment,
                    paidOn: paidOn,
                    missedDays: (try? daysStrictlyBetween(date, paidOn)) ?? []
                ))
                continue
            }
            resolutions.append(InstallmentResolution(
                dueDate: date,
                status: .missed,
                paidOn: nil,
                missedDays: (try? missedStretch(date, today, next)) ?? []
            ))
        }
        return resolutions
    }

    public static func marks(_ resolutions: [InstallmentResolution]) -> [MarkedDay] {
        var map: [String: Set<CalendarMark>] = [:]
        func add(_ date: String, _ mark: CalendarMark) {
            var set = map[date] ?? []
            set.insert(mark)
            map[date] = set
        }
        for slot in resolutions {
            add(slot.dueDate, .due)
            switch slot.status {
            case .onTime:
                add(slot.dueDate, .onTime)
            case .latePayment:
                add(slot.dueDate, .lateDue)
                if let paidOn = slot.paidOn { add(paidOn, .latePaid) }
                for day in slot.missedDays { add(day, .missed) }
            case .missed:
                for day in slot.missedDays { add(day, .missed) }
            case .upcoming:
                add(slot.dueDate, .upcoming)
            }
        }
        return map.keys.sorted().map { date in
            MarkedDay(date: date, marks: CalendarMark.allCases.filter { map[date]?.contains($0) == true })
        }
    }

    public static func planMonthKeys(_ dates: [String]) -> [String] {
        var keys: [String] = []
        for date in dates.sorted() {
            guard date.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { continue }
            let key = String(date.prefix(7))
            if !keys.contains(key) { keys.append(key) }
        }
        return keys
    }

    public static func defaultMonthIndex(months: [String], today: String, upcomingDate: String?) -> Int {
        if months.isEmpty { return 0 }
        if let upcomingDate {
            let upcoming = months.firstIndex(of: String(upcomingDate.prefix(7))) ?? -1
            if upcoming >= 0 { return upcoming }
        }
        let current = months.firstIndex(of: String(today.prefix(7))) ?? -1
        if current >= 0 { return current }
        return 0
    }

    public static func stepMonthIndex(_ index: Int, delta: Int, count: Int) -> Int {
        if count <= 0 { return 0 }
        let next = index + delta
        if next < 0 { return 0 }
        if next > count - 1 { return count - 1 }
        return next
    }

    public static func goalContributions(_ contributions: [PlanContribution], startDate: String) -> [PlanContribution] {
        contributions.filter { $0.amountCents > 0 && $0.paidOn >= startDate }
    }

    public static func goalHealth(
        today: String,
        dueDates: [String],
        contributions: [PlanContribution],
        progressPercent: Int
    ) -> GoalHealth {
        if progressPercent >= 100 { return .complete }
        let slots = resolveSlots(dates: dueDates, today: today, contributions: contributions)
        if slots.contains(where: { $0.status == .missed }) { return .late }
        if let next = slots.first(where: { $0.status == .upcoming }),
           let tomorrow = try? CivilDate.addDays(today, 1),
           next.dueDate <= tomorrow {
            return .nearLate
        }
        return .onTrack
    }

    private static func missedStretch(_ due: String, _ today: String, _ nextDue: String?) throws -> [String] {
        if today < due { return [] }
        var end = today
        if let nextDue, nextDue <= today { end = try CivilDate.addDays(nextDue, -1) }
        if end < due { return [] }
        return try eachDay(due, end)
    }

    private static func daysStrictlyBetween(_ due: String, _ paidOn: String) throws -> [String] {
        let start = try CivilDate.addDays(due, 1)
        let end = try CivilDate.addDays(paidOn, -1)
        if end < start { return [] }
        return try eachDay(start, end)
    }

    private static func eachDay(_ start: String, _ end: String) throws -> [String] {
        var days: [String] = []
        var cursor = start
        while cursor <= end && days.count < 800 {
            days.append(cursor)
            cursor = try CivilDate.addDays(cursor, 1)
        }
        return days
    }
}
