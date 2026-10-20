import Foundation

public enum PlanCopy {
    public static func periodLabel(_ frequency: ContributionFrequency) -> String {
        switch frequency {
        case .daily: "por dia"
        case .weekly: "por semana"
        case .monthly: "por mês"
        }
    }

    public static func shortLabel(_ frequency: ContributionFrequency) -> String {
        switch frequency {
        case .daily: "Diário"
        case .weekly: "Semanal"
        case .monthly: "Mensal"
        }
    }

    public static func rhythmLabel(_ frequency: ContributionFrequency, count: Int) -> String {
        if count == 1 {
            switch frequency {
            case .daily: return "diário"
            case .weekly: return "semanal"
            case .monthly: return "mensal"
            }
        }
        switch frequency {
        case .daily: return "diários"
        case .weekly: return "semanais"
        case .monthly: return "mensais"
        }
    }

    public static func summary(_ plan: ContributionPlan, frequency: ContributionFrequency) -> String {
        let count = plan.installmentCount
        let noun = count == 1 ? "aporte" : "aportes"
        let end = longDate(plan.dates.last ?? "")
        return "\(count) \(noun) \(rhythmLabel(frequency, count: count)) até \(end)"
    }

    public static func longDate(_ iso: String) -> String {
        guard let parts = CivilDate.parse(iso) else { return iso }
        return "\(parts.day) de \(shortMonth(parts.month)). de \(parts.year)"
    }

    public static func chip(iso: String) -> (day: String, month: String) {
        guard let parts = CivilDate.parse(iso) else { return (iso, "") }
        return (String(format: "%02d", parts.day), shortMonth(parts.month))
    }

    /// Day and short month, without the year. Example: "19 de nov".
    public static func dayMonth(_ iso: String) -> String {
        guard let parts = CivilDate.parse(iso) else { return iso }
        return "\(String(format: "%02d", parts.day)) de \(shortMonth(parts.month))"
    }

    public static func depositPhrase(_ status: DepositStatus) -> String {
        switch status {
        case .paidOnTime: "pago no prazo"
        case .paidLate: "pago fora do prazo"
        case .pending: "a vencer"
        case .missed: "em atraso"
        }
    }

    public static func calendarPayoff(health: GoalHealth, dues: [GoalCalendarDue]) -> String {
        switch health {
        case .complete:
            return "Meta cumprida."
        case .late:
            return "Tem aporte em atraso. Os dias ficam marcados."
        case .nearLate:
            return "O próximo aporte está perto."
        case .onTrack:
            if !dues.isEmpty, dues.allSatisfy({ $0.status == .onTime }) {
                return "Meta cumprida no prazo."
            }
            return "Você chega lá."
        }
    }

    public static func monthTitle(year: Int, month: Int) -> String {
        let name = longMonth(month)
        return "\(name) de \(year)"
    }

    public static let weekdays = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]

    private static func shortMonth(_ month: Int) -> String {
        switch month {
        case 1: "jan"
        case 2: "fev"
        case 3: "mar"
        case 4: "abr"
        case 5: "mai"
        case 6: "jun"
        case 7: "jul"
        case 8: "ago"
        case 9: "set"
        case 10: "out"
        case 11: "nov"
        case 12: "dez"
        default: ""
        }
    }

    private static func longMonth(_ month: Int) -> String {
        switch month {
        case 1: "janeiro"
        case 2: "fevereiro"
        case 3: "março"
        case 4: "abril"
        case 5: "maio"
        case 6: "junho"
        case 7: "julho"
        case 8: "agosto"
        case 9: "setembro"
        case 10: "outubro"
        case 11: "novembro"
        case 12: "dezembro"
        default: ""
        }
    }
}
