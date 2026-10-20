import Foundation

public enum ContributionFrequency: String, Codable, Sendable, CaseIterable {
    case daily
    case weekly
    case monthly
}

public enum ContributionSlotStatus: String, Codable, Sendable {
    case onTime = "on_time"
    case late
    case missed
    case upcoming

    public var label: String {
        switch self {
        case .onTime: "Aportado no prazo"
        case .late: "Aportado atrasado"
        case .missed: "Não aportado"
        case .upcoming: "A aportar"
        }
    }
}

public struct ContributionPlan: Equatable, Sendable {
    public var remainingCents: Int
    public var installmentCount: Int
    public var amountPerInstallmentCents: Int
    public var lastInstallmentCents: Int
    public var dates: [String]
}

public struct PlanContribution: Equatable, Sendable {
    public var paidOn: String
    public var amountCents: Int
    public init(paidOn: String, amountCents: Int) {
        self.paidOn = paidOn
        self.amountCents = amountCents
    }
}

public struct AppliedInstallment: Equatable, Sendable {
    public var dueDate: String
    public var baseCents: Int
    public var dueCents: Int
    public var paidCents: Int
    public var paid: Bool
    public var settledOn: String?
    public var antecipado: Bool
}

public enum ContributionPlanMath {
    public static func installmentCentsAt(_ plan: ContributionPlan, index: Int) throws -> Int {
        if index < 0 || index >= plan.installmentCount {
            throw CoreFailure("Aporte fora do plano.")
        }
        if index == plan.installmentCount - 1 { return plan.lastInstallmentCents }
        return plan.amountPerInstallmentCents
    }

    public static func build(
        targetCents: Double,
        contributedCents: Double,
        startDate: String,
        endDate: String,
        frequency: ContributionFrequency
    ) throws -> ContributionPlan {
        if !targetCents.isFinite || targetCents <= 0 { throw CoreFailure("Valor da meta inválido.") }
        if !contributedCents.isFinite { throw CoreFailure("Valor já aportado inválido.") }
        let start = startDate.trimmingCharacters(in: .whitespacesAndNewlines)
        let end = endDate.trimmingCharacters(in: .whitespacesAndNewlines)
        if CivilDate.parse(start) == nil || CivilDate.parse(end) == nil { throw CoreFailure("Data inválida.") }
        if end <= start { throw CoreFailure("A data para concluir precisa ser depois do início.") }
        let target = Int(targetCents.rounded())
        let contributed = max(0, Int(contributedCents.rounded()))
        let remaining = max(0, target - contributed)
        let dates = try scheduleDates(start, end, frequency)
        let count = dates.count
        let per = Int(floor(Double(remaining) / Double(count)))
        let last = remaining - per * (count - 1)
        return ContributionPlan(
            remainingCents: remaining,
            installmentCount: count,
            amountPerInstallmentCents: per,
            lastInstallmentCents: last,
            dates: dates
        )
    }

    public static func assignStatuses(
        dates: [String],
        today: String,
        contributions: [PlanContribution]
    ) -> [ContributionSlotStatus] {
        var pool = usable(contributions, today: today)
        var statuses: [ContributionSlotStatus] = []
        for index in dates.indices {
            let date = dates[index]
            let previous = index > 0 ? dates[index - 1] : ""
            let next = index + 1 < dates.count ? dates[index + 1] : nil
            if let found = pool.firstIndex(where: { !$0.used && $0.paidOn > previous && $0.paidOn <= date }) {
                pool[found].used = true
                statuses.append(.onTime)
                continue
            }
            if date >= today {
                statuses.append(.upcoming)
                continue
            }
            if let found = pool.firstIndex(where: { item in
                if item.used { return false }
                if item.paidOn <= date || item.paidOn > today { return false }
                if let next, item.paidOn >= next { return false }
                return true
            }) {
                pool[found].used = true
                statuses.append(.late)
                continue
            }
            statuses.append(.missed)
        }
        return statuses
    }

    public static func applyEarlyPayments(
        installments: [(dueDate: String, amountCents: Int)],
        contributions: [PlanContribution]
    ) -> [AppliedInstallment] {
        var rows = installments.map { item -> AppliedInstallment in
            let base = max(0, item.amountCents)
            return AppliedInstallment(
                dueDate: item.dueDate,
                baseCents: base,
                dueCents: base,
                paidCents: 0,
                paid: base == 0,
                settledOn: nil,
                antecipado: false
            )
        }
        let payments = contributions
            .filter { $0.amountCents > 0 && CivilDate.parse($0.paidOn) != nil }
            .map { (paidOn: $0.paidOn, amountCents: $0.amountCents) }
            .sorted { $0.paidOn < $1.paidOn }
        for payment in payments {
            var money = payment.amountCents
            var carried = false
            for index in rows.indices {
                if money <= 0 { break }
                if rows[index].dueCents <= 0 { continue }
                let needed = rows[index].dueCents
                let exceeds = money > needed
                if carried || (payment.paidOn < rows[index].dueDate && exceeds) {
                    rows[index].antecipado = true
                }
                let take = min(money, needed)
                rows[index].dueCents -= take
                rows[index].paidCents += take
                money -= take
                if rows[index].dueCents == 0 {
                    rows[index].paid = true
                    rows[index].settledOn = payment.paidOn
                }
                carried = money > 0
            }
        }
        for index in rows.indices {
            if rows[index].dueCents < 0 { rows[index].dueCents = 0 }
            if rows[index].dueCents == 0 { rows[index].paid = true }
            if !rows[index].paid && rows[index].dueCents < rows[index].baseCents {
                rows[index].antecipado = true
            }
        }
        return rows
    }

    public static func nextOpenAporteCents(_ rows: [AppliedInstallment]) -> Int? {
        rows.first { !$0.paid }?.dueCents
    }

    private struct PoolItem {
        var paidOn: String
        var used: Bool
    }

    private static func usable(_ contributions: [PlanContribution], today: String) -> [PoolItem] {
        contributions
            .filter { $0.amountCents > 0 && $0.paidOn <= today && CivilDate.parse($0.paidOn) != nil }
            .sorted { $0.paidOn < $1.paidOn }
            .map { PoolItem(paidOn: $0.paidOn, used: false) }
    }

    private static func scheduleDates(_ start: String, _ end: String, _ frequency: ContributionFrequency) throws -> [String] {
        var dates: [String] = []
        for step in 0..<4000 {
            let cursor = try stepFromStart(start, frequency, step)
            if cursor > end { break }
            dates.append(cursor)
        }
        if dates.isEmpty { throw CoreFailure("Nenhum aporte cabe nesse prazo.") }
        if dates.count >= 4000, try stepFromStart(start, frequency, dates.count) <= end {
            throw CoreFailure("Prazo longo demais para esta frequência.")
        }
        return dates
    }

    private static func stepFromStart(_ start: String, _ frequency: ContributionFrequency, _ step: Int) throws -> String {
        switch frequency {
        case .daily: try CivilDate.addDays(start, step)
        case .weekly: try CivilDate.addDays(start, step * 7)
        case .monthly: try CivilDate.addMonths(start, step)
        }
    }
}
