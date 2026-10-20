import Foundation

public struct GoalCalendarDue: Equatable, Sendable {
    public var date: String
    public var amountCents: Int
    public var status: InstallmentStatus
    public var note: String?

    public init(date: String, amountCents: Int, status: InstallmentStatus, note: String? = nil) {
        self.date = date
        self.amountCents = amountCents
        self.status = status
        self.note = note
    }
}

public struct GoalCalendarData: Equatable, Sendable {
    public var goalName: String
    public var frequency: ContributionFrequency
    public var installmentCount: Int
    public var heroCents: Int
    public var heroLabel: String?
    public var lastCents: Int
    public var deadline: String
    public var dues: [GoalCalendarDue]
    public var marks: [MarkedDay]
    public var health: GoalHealth
}

public struct GoalSchedule: Equatable, Sendable {
    public var contributions: [PlanContribution]
    public var savedCents: Int
    public var progressPercent: Int
    public var applied: [AppliedInstallment]
    public var slots: [InstallmentResolution]
    public var calendar: GoalCalendarData
    public var plan: ContributionPlan
}

public enum GoalScheduleMath {
    /// An early payment that settles the installment follows the on-time rule.
    public static func settle(
        _ slot: InstallmentResolution,
        row: AppliedInstallment?
    ) -> InstallmentResolution {
        guard let row, row.paid else { return slot }
        let late = row.settledOn != nil && (row.settledOn ?? "") > slot.dueDate
        return InstallmentResolution(
            dueDate: slot.dueDate,
            status: late ? .latePayment : .onTime,
            paidOn: row.settledOn,
            missedDays: late ? slot.missedDays : []
        )
    }

    public static func build(
        name: String,
        amountCents: Int,
        startDate: String,
        targetDate: String,
        frequency: ContributionFrequency,
        contributions: [PlanContribution],
        today: String
    ) throws -> GoalSchedule {
        let plan = try ContributionPlanMath.build(
            targetCents: Double(amountCents),
            contributedCents: 0,
            startDate: startDate,
            endDate: targetDate,
            frequency: frequency
        )
        let paid = GoalCalendarMath.goalContributions(contributions, startDate: startDate)
        let applied = ContributionPlanMath.applyEarlyPayments(
            installments: plan.dates.enumerated().map { index, date in
                let cents = (try? ContributionPlanMath.installmentCentsAt(plan, index: index)) ?? plan.amountPerInstallmentCents
                return (dueDate: date, amountCents: cents)
            },
            contributions: paid
        )
        let raw = GoalCalendarMath.resolveSlots(dates: plan.dates, today: today, contributions: paid)
        let slots = raw.enumerated().map { index, slot in
            settle(slot, row: index < applied.count ? applied[index] : nil)
        }
        let saved = paid.reduce(0) { $0 + $1.amountCents }
        let progress = amountCents > 0 ? max(0, min(100, Int((Double(saved) / Double(amountCents) * 100).rounded()))) : 0
        let nextOpen = applied.first { !$0.paid }
        let dues = applied.enumerated().map { index, row in
            GoalCalendarDue(
                date: row.dueDate,
                amountCents: row.paid ? row.baseCents : row.dueCents,
                status: index < slots.count ? slots[index].status : .upcoming,
                note: !row.paid && row.antecipado ? "Antecipado" : nil
            )
        }
        let calendar = GoalCalendarData(
            goalName: name,
            frequency: frequency,
            installmentCount: plan.installmentCount,
            heroCents: nextOpen?.dueCents ?? 0,
            heroLabel: (nextOpen != nil && (nextOpen?.dueCents ?? 0) < (nextOpen?.baseCents ?? 0)) ? "Próximo aporte" : nil,
            lastCents: applied.last?.dueCents ?? plan.lastInstallmentCents,
            deadline: targetDate,
            dues: dues,
            marks: GoalCalendarMath.marks(slots),
            health: GoalCalendarMath.goalHealth(
                today: today,
                dueDates: plan.dates,
                contributions: paid,
                progressPercent: progress
            )
        )
        return GoalSchedule(
            contributions: paid,
            savedCents: saved,
            progressPercent: progress,
            applied: applied,
            slots: slots,
            calendar: calendar,
            plan: plan
        )
    }

    /// Monday-first month grid. Leading blanks are nil.
    public static func monthCells(year: Int, month: Int) -> [String?] {
        guard month >= 1, month <= 12 else { return [] }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        var parts = DateComponents()
        parts.calendar = calendar
        parts.timeZone = TimeZone(identifier: "UTC")!
        parts.year = year
        parts.month = month
        parts.day = 1
        guard let first = calendar.date(from: parts) else { return [] }
        let weekday = calendar.component(.weekday, from: first)
        let lead = (weekday + 5) % 7
        let count = calendar.range(of: .day, in: .month, for: first)?.count ?? 0
        var cells: [String?] = Array(repeating: nil, count: lead)
        for day in 1...count {
            cells.append(String(format: "%04d-%02d-%02d", year, month, day))
        }
        return cells
    }
}
