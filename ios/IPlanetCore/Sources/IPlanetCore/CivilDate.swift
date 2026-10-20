import Foundation

public struct CoreFailure: Error, Equatable, CustomStringConvertible, Sendable {
    public var description: String
    public init(_ description: String) { self.description = description }
}

public enum CivilDate {
    public static func parse(_ value: String) -> (year: Int, month: Int, day: Int)? {
        guard value.count == 10 else { return nil }
        let parts = value.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]) else {
            return nil
        }
        var calendar = utc
        var comps = DateComponents()
        comps.calendar = calendar
        comps.timeZone = TimeZone(secondsFromGMT: 0)
        comps.year = year
        comps.month = month
        comps.day = day
        guard let date = calendar.date(from: comps) else { return nil }
        let back = calendar.dateComponents([.year, .month, .day], from: date)
        guard back.year == year, back.month == month, back.day == day else { return nil }
        return (year, month, day)
    }

    public static func format(year: Int, month: Int, day: Int) -> String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    public static func calendarToday(_ now: Date = Date()) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? TimeZone(identifier: "UTC")!
        let parts = calendar.dateComponents([.year, .month, .day], from: now)
        return format(year: parts.year ?? 1970, month: parts.month ?? 1, day: parts.day ?? 1)
    }

    public static func isoDateInTimeZone(_ instantISO: String, timeZone: String = "America/Sao_Paulo") -> String? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let instant = formatter.date(from: instantISO) ?? ISO8601DateFormatter().date(from: instantISO)
        guard let instant else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        guard let zone = TimeZone(identifier: timeZone) else { return nil }
        calendar.timeZone = zone
        let parts = calendar.dateComponents([.year, .month, .day], from: instant)
        guard let year = parts.year, let month = parts.month, let day = parts.day else { return nil }
        let formatted = format(year: year, month: month, day: day)
        return parse(formatted) == nil ? nil : formatted
    }

    public static func addDays(_ iso: String, _ days: Int) throws -> String {
        guard let parsed = parse(iso) else { throw CoreFailure("Data inválida.") }
        var calendar = utc
        var comps = DateComponents()
        comps.calendar = calendar
        comps.timeZone = TimeZone(secondsFromGMT: 0)
        comps.year = parsed.year
        comps.month = parsed.month
        comps.day = parsed.day + days
        guard let date = calendar.date(from: comps) else { throw CoreFailure("Data inválida.") }
        let out = calendar.dateComponents([.year, .month, .day], from: date)
        guard let year = out.year, let month = out.month, let day = out.day else {
            throw CoreFailure("Data inválida.")
        }
        return format(year: year, month: month, day: day)
    }

    public static func addMonths(_ iso: String, _ delta: Int) throws -> String {
        guard let parsed = parse(iso) else { throw CoreFailure("Data inválida.") }
        var calendar = utc
        var first = DateComponents()
        first.calendar = calendar
        first.timeZone = TimeZone(secondsFromGMT: 0)
        first.year = parsed.year
        first.month = parsed.month + delta
        first.day = 1
        guard let shifted = calendar.date(from: first) else { throw CoreFailure("Data inválida.") }
        let lastDay = calendar.range(of: .day, in: .month, for: shifted)?.count ?? 28
        let day = min(parsed.day, lastDay)
        let parts = calendar.dateComponents([.year, .month], from: shifted)
        guard let year = parts.year, let month = parts.month else { throw CoreFailure("Data inválida.") }
        return format(year: year, month: month, day: day)
    }

    private static var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }
}
