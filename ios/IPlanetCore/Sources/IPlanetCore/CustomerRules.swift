import Foundation

public enum MoneyFormat {
    public static func centsBRL(_ cents: Int) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.numberStyle = .currency
        formatter.currencyCode = "BRL"
        return formatter.string(from: NSNumber(value: Double(cents) / 100)) ?? "R$ 0,00"
    }
}

public enum PhoneRules {
    public static func normalizeBrazilPhone(_ raw: String?) -> String? {
        guard let raw else { return nil }
        var digits = raw.filter(\.isNumber)
        while digits.hasPrefix("0") { digits.removeFirst() }
        if digits.hasPrefix("00") { digits.removeFirst(2) }
        if digits.isEmpty { return nil }
        if digits.count == 10 || digits.count == 11 { digits = "55" + digits }
        return digits
    }
}

public enum ReferralRules {
    public static let activationCents = 10_000
    public static func activated(confirmedCents: Int, bonusCredited: Bool) -> Bool {
        confirmedCents >= activationCents || bonusCredited
    }
}

public enum RaffleRules {
    public static let fichaCents = 10_000
    public static let minProgressPct = 30
    public static let eligibilityMessage =
        "Apenas será considerado a participação do sorteio caso esteja concluído 30% do valor de aportes."

    public static func tickets(fromCents cents: Int, perTicket: Int = fichaCents) -> Int {
        guard perTicket > 0 else { return 0 }
        return cents / perTicket
    }

    public static func reservationEligible(contributedCents: Int, listPriceCents: Int, minPct: Int = minProgressPct) -> Bool {
        if listPriceCents <= 0 { return false }
        return contributedCents * 100 >= listPriceCents * minPct
    }

    public static func eligibilityGapCents(contributedCents: Int, listPriceCents: Int, minPct: Int = minProgressPct) -> Int {
        if listPriceCents <= 0 { return 0 }
        return max(0, Int(ceil(Double(listPriceCents * minPct) / 100)) - contributedCents)
    }

    public struct Balance: Equatable, Sendable {
        public var userId: String
        public var contributedCents: Int
        public var eligibleCents: Int
        public var eligible: Bool
        public var rawTickets: Int
        public var tickets: Int
    }

    public struct Contribution: Sendable {
        public var userId: String
        public var reservationId: String
        public var amountCents: Int
        public init(userId: String, reservationId: String, amountCents: Int) {
            self.userId = userId
            self.reservationId = reservationId
            self.amountCents = amountCents
        }
    }

    public static func balances(
        contributions: [Contribution],
        prices: [String: Int],
        baseline: [String: Int] = [:],
        perTicket: Int = fichaCents,
        minPct: Int = minProgressPct
    ) -> [Balance] {
        var byReservation: [String: (userId: String, cents: Int)] = [:]
        for item in contributions {
            let current = byReservation[item.reservationId]
            byReservation[item.reservationId] = (item.userId, (current?.cents ?? 0) + item.amountCents)
        }
        var byUser: [String: (contributed: Int, eligible: Int)] = [:]
        for (reservationId, row) in byReservation {
            var totals = byUser[row.userId] ?? (0, 0)
            totals.contributed += row.cents
            if reservationEligible(contributedCents: row.cents, listPriceCents: prices[reservationId] ?? 0, minPct: minPct) {
                totals.eligible += row.cents
            }
            byUser[row.userId] = totals
        }
        return byUser.map { userId, totals in
            let raw = tickets(fromCents: totals.eligible, perTicket: perTicket)
            let offset = max(0, baseline[userId] ?? 0)
            return Balance(
                userId: userId,
                contributedCents: totals.contributed,
                eligibleCents: totals.eligible,
                eligible: totals.eligible > 0,
                rawTickets: raw,
                tickets: max(0, raw - offset)
            )
        }
    }
}

public enum IdentityRules {
    public static let states = [
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
        "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
    ]

    public static func normalizeCPF(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let digits = raw.filter(\.isNumber)
        if digits.count != 11 { return nil }
        if Set(digits).count == 1 { return nil }
        return digits
    }

    public static func normalizeState(_ raw: String?) -> String? {
        let value = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return states.contains(value) ? value : nil
    }

    public static func validBirthDate(_ raw: String?, now: Date = Date()) -> Bool {
        guard let raw else { return false }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let parsed = CivilDate.parse(trimmed) else { return false }
        if parsed.year < 1900 { return false }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let today = calendar.dateComponents([.year, .month, .day], from: now)
        guard let year = today.year, let month = today.month, let day = today.day else { return false }
        let birth = parsed.year * 10_000 + parsed.month * 100 + parsed.day
        let current = year * 10_000 + month * 100 + day
        return birth <= current
    }

    public static func missingMessage(
        cpf: String?,
        phone: String?,
        city: String?,
        state: String?,
        address: String?,
        addressNumber: String?,
        birthDate: String?
    ) -> String? {
        if normalizeCPF(cpf) == nil { return "Informe um CPF válido com 11 dígitos." }
        let digits = (phone ?? "").filter(\.isNumber)
        if digits.count < 10 || digits.count > 13 { return "Informe um telefone válido com DDD." }
        if (city ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Informe a cidade." }
        if normalizeState(state) == nil { return "Informe o estado (UF)." }
        if (address ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Informe o endereço." }
        if (addressNumber ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Informe o número." }
        if !validBirthDate(birthDate) { return "Informe uma data de nascimento válida." }
        return nil
    }
}

public enum FulfillmentStatus: String, Sendable, CaseIterable {
    case pending, approved, inTransit = "in_transit", readyPickup = "ready_pickup", completed, cancelled
}

public enum FulfillmentMode: String, Sendable { case store, shipping }

public enum FulfillmentRules {
    public static func statusLabel(_ status: FulfillmentStatus, mode: FulfillmentMode) -> String {
        switch status {
        case .pending: mode == .shipping ? "Aguardando pagamento do frete" : "Retirada solicitada"
        case .approved: "Em preparação"
        case .inTransit: "Enviado"
        case .readyPickup: "Pronto para retirada na loja"
        case .completed: mode == .shipping ? "Entregue" : "Retirado"
        case .cancelled: "Cancelado"
        }
    }

    public static func shippingMethodLabel(_ method: String?) -> String {
        switch method {
        case nil, "": ""
        case "sedex": "SEDEX"
        case "pac": "PAC"
        case "motoboy": "Motoboy (capital)"
        default: method ?? ""
        }
    }

    public static func initialStatus(_ mode: FulfillmentMode) -> FulfillmentStatus {
        switch mode {
        case .store, .shipping: .pending
        }
    }

    public static func formatAddress(street: String, number: String, city: String, state: String, zip: String) -> String {
        let streetLine = [street, number].filter { !$0.isEmpty }.joined(separator: ", ")
        let cityState = [city, state].filter { !$0.isEmpty }.joined(separator: "/")
        let digits = zip.filter(\.isNumber)
        let formattedZip = digits.count == 8 ? "\(digits.prefix(5))-\(digits.suffix(3))" : zip
        return [streetLine, cityState, formattedZip.isEmpty ? "" : "CEP \(formattedZip)"]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }
}

public enum TradeInRules {
    public static let maxDevices = 5
    public static let maxPhotos = 5
    public static let validDays = 90

    public static func decisionValue(action: String, informedCents: Int, proposedCents: Int?) -> Int? {
        switch action {
        case "approve": informedCents
        case "counter": proposedCents
        default: nil
        }
    }

    public static func daysRemaining(reviewedAt: Date, now: Date) -> Int {
        let expires = reviewedAt.addingTimeInterval(Double(validDays) * 86_400)
        return max(0, Int(ceil(expires.timeIntervalSince(now) / 86_400)))
    }

    public static func parseBattery(pctRaw: String?, reasonRaw: String?) -> Result<BatteryHealth, CoreFailure> {
        let pct = (pctRaw ?? "").replacingOccurrences(of: "%", with: "").trimmingCharacters(in: .whitespaces)
        let reason = (reasonRaw ?? "").trimmingCharacters(in: .whitespaces)
        if !reason.isEmpty {
            if (reason != "unknown" && reason != "not_applicable") || !pct.isEmpty {
                return .failure(CoreFailure("Estado da bateria inválido."))
            }
            return .success(BatteryHealth(pct: nil, reason: reason))
        }
        if pct.isEmpty { return .failure(CoreFailure("Informe o estado da bateria.")) }
        guard pct.allSatisfy(\.isNumber), let value = Int(pct), value <= 100 else {
            return .failure(CoreFailure("O estado da bateria deve ser um número inteiro entre 0 e 100."))
        }
        return .success(BatteryHealth(pct: value, reason: nil))
    }

    public struct BatteryHealth: Equatable, Sendable {
        public var pct: Int?
        public var reason: String?
    }

    public static func reasonLabel(_ reason: String) -> String {
        switch reason {
        case "unknown": "Não sei"
        case "not_applicable": "Não se aplica"
        default: reason
        }
    }
}
