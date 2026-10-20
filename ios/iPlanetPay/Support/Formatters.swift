import Foundation

enum Money {
    static func format(cents: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.currencyCode = "BRL"
        let value = Decimal(cents) / 100
        return formatter.string(from: value as NSDecimalNumber) ?? "R$ 0,00"
    }

    static func cents(from text: String) -> Int? {
        var raw = text
            .replacingOccurrences(of: "R$", with: "")
            .replacingOccurrences(of: " ", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }
        if raw.contains(",") {
            raw = raw.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
        }
        guard let decimal = Decimal(string: raw, locale: Locale(identifier: "en_US_POSIX")) else {
            return nil
        }
        let cents = NSDecimalNumber(decimal: decimal * 100).intValue
        return cents
    }
}

enum CivilDay {
    static var zone: TimeZone { TimeZone(identifier: "America/Sao_Paulo") ?? .gmt }

    static func string(from date: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

enum DatesPT {
    static func medium(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    static func mediumTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    static func isoDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func parseDay(_ raw: String?) -> Date? {
        guard let raw, raw.count >= 10 else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(raw.prefix(10)))
    }

    static func daysUntilNextRaffle(from date: Date = Date()) -> Int {
        let calendar = Calendar(identifier: .gregorian)
        var parts = calendar.dateComponents([.year, .month], from: date)
        let month = parts.month ?? 1
        parts.month = month + 1
        parts.day = 1
        guard var target = calendar.date(from: parts) else { return 0 }
        if target <= date {
            parts.month = month + 2
            target = calendar.date(from: parts) ?? target
        }
        let seconds = target.timeIntervalSince(date)
        return max(0, Int(ceil(seconds / 86_400)))
    }
}

enum BrazilPhone {
    static func normalize(_ raw: String?) -> String? {
        guard let raw else { return nil }
        var digits = raw.filter(\.isNumber)
        while digits.hasPrefix("0") {
            digits.removeFirst()
        }
        if digits.hasPrefix("00") {
            digits = String(digits.dropFirst(2))
        }
        guard !digits.isEmpty else { return nil }
        if digits.count == 10 || digits.count == 11 {
            digits = "55" + digits
        }
        return digits
    }
}

enum BrazilID {
    static let states = [
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
        "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
        "SP", "SE", "TO",
    ]

    static func normalizeCPF(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let digits = raw.filter(\.isNumber)
        guard digits.count == 11 else { return nil }
        if Set(digits).count == 1 { return nil }
        return digits
    }

    static func formatCPF(_ raw: String?) -> String {
        guard let digits = normalizeCPF(raw) else { return raw ?? "" }
        let a = digits.prefix(3)
        let b = digits.dropFirst(3).prefix(3)
        let c = digits.dropFirst(6).prefix(3)
        let d = digits.suffix(2)
        return "\(a).\(b).\(c)-\(d)"
    }

    static func validBirthDate(_ raw: String?) -> Bool {
        guard let date = DatesPT.parseDay(raw) else { return false }
        let calendar = Calendar(identifier: .gregorian)
        let year = calendar.component(.year, from: date)
        if year < 1900 { return false }
        return date <= Date()
    }
}

func describeError(_ error: Error) -> String {
    let mirror = Mirror(reflecting: error)
    if let message = mirror.children.first(where: { $0.label == "message" })?.value as? String {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
    }
    let localized = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
    let generic = localized.isEmpty
        || localized.localizedCaseInsensitiveContains("couldn’t be completed")
        || localized.localizedCaseInsensitiveContains("couldn't be completed")
    if !generic { return localized }
    let raw = String(describing: error)
    if let range = raw.range(of: "message: \"") {
        let rest = raw[range.upperBound...]
        if let end = rest.firstIndex(of: "\"") {
            let message = String(rest[..<end])
            if !message.isEmpty { return message }
        }
    }
    return "Não foi possível concluir agora."
}
