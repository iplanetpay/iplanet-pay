import XCTest
@testable import IPlanetCore

final class CoreTests: XCTestCase {
    func testContributionPlanMatchesTheSite() throws {
        let daily = try ContributionPlanMath.build(
            targetCents: 400, contributedCents: 0, startDate: "2026-01-01", endDate: "2026-01-04", frequency: .daily
        )
        XCTAssertEqual(daily.dates, ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"])
        XCTAssertEqual(daily.amountPerInstallmentCents, 100)
        XCTAssertEqual(daily.lastInstallmentCents, 100)

        let weekly = try ContributionPlanMath.build(
            targetCents: 400, contributedCents: 0, startDate: "2026-01-01", endDate: "2026-01-29", frequency: .weekly
        )
        XCTAssertEqual(weekly.dates, ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29"])
        XCTAssertEqual(weekly.amountPerInstallmentCents, 80)

        let monthly = try ContributionPlanMath.build(
            targetCents: 300, contributedCents: 0, startDate: "2026-01-31", endDate: "2026-03-31", frequency: .monthly
        )
        XCTAssertEqual(monthly.dates, ["2026-01-31", "2026-02-28", "2026-03-31"])

        let remainder = try ContributionPlanMath.build(
            targetCents: 100, contributedCents: 0, startDate: "2026-05-01", endDate: "2026-05-03", frequency: .daily
        )
        XCTAssertEqual(remainder.amountPerInstallmentCents, 33)
        XCTAssertEqual(remainder.lastInstallmentCents, 34)

        XCTAssertThrowsError(
            try ContributionPlanMath.build(
                targetCents: 100, contributedCents: 0, startDate: "2026-05-01", endDate: "2026-05-01", frequency: .daily
            )
        ) { error in
            XCTAssertTrue(String(describing: error).contains("depois do início"))
        }
    }

    func testEarlyPaymentsReduceTheNextAporte() {
        let installments = [
            (dueDate: "2026-11-01", amountCents: 10000),
            (dueDate: "2026-12-01", amountCents: 10000),
            (dueDate: "2027-01-01", amountCents: 10000),
        ]
        let early = ContributionPlanMath.applyEarlyPayments(
            installments: installments,
            contributions: [PlanContribution(paidOn: "2026-10-15", amountCents: 15000)]
        )
        XCTAssertEqual(early[0].paid, true)
        XCTAssertEqual(early[1].dueCents, 5000)
        XCTAssertEqual(early[1].antecipado, true)
        XCTAssertEqual(ContributionPlanMath.nextOpenAporteCents(early), 5000)

        let overflow = ContributionPlanMath.applyEarlyPayments(
            installments: installments,
            contributions: [PlanContribution(paidOn: "2026-10-01", amountCents: 50000)]
        )
        XCTAssertEqual(overflow.map(\.dueCents), [0, 0, 0])
        XCTAssertNil(ContributionPlanMath.nextOpenAporteCents(overflow))
    }

    func testCalendarMarksAndGoalHealth() throws {
        let months = GoalCalendarMath.planMonthKeys(["2026-12-18", "2026-11-18", "2027-01-18", "2026-11-18"])
        XCTAssertEqual(months, ["2026-11", "2026-12", "2027-01"])
        XCTAssertEqual(GoalCalendarMath.defaultMonthIndex(months: months, today: "2026-11-02", upcomingDate: "2026-12-18"), 1)
        XCTAssertEqual(GoalCalendarMath.stepMonthIndex(0, delta: -1, count: months.count), 0)

        let statuses = ContributionPlanMath.assignStatuses(
            dates: ["2026-01-10", "2026-01-17", "2026-01-24", "2026-01-31"],
            today: "2026-01-20",
            contributions: [
                PlanContribution(paidOn: "2026-01-10", amountCents: 1000),
                PlanContribution(paidOn: "2026-01-18", amountCents: 1000),
            ]
        )
        XCTAssertEqual(statuses, [.onTime, .late, .upcoming, .upcoming])

        let late = GoalCalendarMath.resolveSlots(
            dates: ["2026-06-10"],
            today: "2026-06-20",
            contributions: [PlanContribution(paidOn: "2026-06-13", amountCents: 100)]
        )
        XCTAssertEqual(late[0].status, .latePayment)
        XCTAssertEqual(late[0].missedDays, ["2026-06-11", "2026-06-12"])

        let missed = GoalCalendarMath.resolveSlots(dates: ["2026-06-10"], today: "2026-06-12", contributions: [])
        XCTAssertEqual(missed[0].missedDays, ["2026-06-10", "2026-06-11", "2026-06-12"])

        XCTAssertEqual(
            GoalCalendarMath.goalHealth(today: "2026-06-10", dueDates: ["2026-06-11"], contributions: [], progressPercent: 10),
            .nearLate
        )
        XCTAssertEqual(
            GoalCalendarMath.goalHealth(today: "2026-06-12", dueDates: ["2026-06-10"], contributions: [], progressPercent: 100),
            .complete
        )

        let counted = GoalCalendarMath.goalContributions(
            [
                PlanContribution(paidOn: "2026-05-01", amountCents: 100),
                PlanContribution(paidOn: "2026-06-01", amountCents: 50),
            ],
            startDate: "2026-06-01"
        )
        XCTAssertEqual(counted.map(\.amountCents), [50])
    }

    func testClimbRopeAndWeather() {
        XCTAssertEqual(ClimbJourney.ropeMark(.missed), .late)
        let many = ClimbJourney.ropePoints(4)
        XCTAssertEqual(many.count, 4)
        XCTAssertGreaterThan(many[0].y, many[1].y)
        XCTAssertEqual(ClimbJourney.supplies(health: .onTrack, progressPercent: 0).map(\.rawValue), ["mochila"])
        XCTAssertEqual(ClimbJourney.supplies(health: .late, progressPercent: 40), [])
        XCTAssertEqual(ClimbJourney.journeyWeather(health: .late, hour: 22, external: nil).kind, .storm)
        XCTAssertEqual(ClimbJourney.climbMotion(.complete), .celebrate)
        XCTAssertEqual(
            ClimbLogic.deriveStatus(
                deposits: [ClimbDeposit(status: .pending, dueDate: "2026-06-10")],
                percent: 10,
                today: "2026-06-10"
            ),
            .nearLate
        )
        XCTAssertEqual(ClimbLogic.relativeDue("2026-06-11", today: "2026-06-10"), "amanhã")
        XCTAssertEqual(ClimbLogic.climbStreak([.paidOnTime, .paidOnTime, .missed, .paidOnTime]), 1)
    }

    func testRaffleIdentityPhoneAndTradeIn() {
        XCTAssertEqual(RaffleRules.tickets(fromCents: 25000), 2)
        XCTAssertFalse(RaffleRules.reservationEligible(contributedCents: 2990, listPriceCents: 10000))
        XCTAssertTrue(RaffleRules.reservationEligible(contributedCents: 3000, listPriceCents: 10000))
        XCTAssertEqual(RaffleRules.eligibilityMessage.contains("30%"), true)
        XCTAssertEqual(PhoneRules.normalizeBrazilPhone("11 97063-8924"), "5511970638924")
        XCTAssertNil(PhoneRules.normalizeBrazilPhone(""))
        XCTAssertFalse(ReferralRules.activated(confirmedCents: 9999, bonusCredited: false))
        XCTAssertTrue(ReferralRules.activated(confirmedCents: 10000, bonusCredited: false))
        XCTAssertEqual(IdentityRules.missingMessage(cpf: "111", phone: "11999999999", city: "SP", state: "SP", address: "Rua", addressNumber: "1", birthDate: "1990-01-01"), "Informe um CPF válido com 11 dígitos.")
        XCTAssertEqual(TradeInRules.decisionValue(action: "counter", informedCents: 200000, proposedCents: 150000), 150000)
        XCTAssertNil(TradeInRules.decisionValue(action: "reject", informedCents: 200000, proposedCents: 150000))
        XCTAssertEqual(TradeInRules.parseBattery(pctRaw: "101", reasonRaw: nil).isFailure, true)
        XCTAssertEqual(TradeInRules.parseBattery(pctRaw: "", reasonRaw: "unknown").isSuccess, true)
        XCTAssertEqual(FulfillmentRules.statusLabel(.completed, mode: .shipping), "Entregue")
        XCTAssertEqual(FulfillmentRules.statusLabel(.completed, mode: .store), "Retirado")
        XCTAssertEqual(
            FulfillmentRules.formatAddress(street: "Rua Joaquim Floriano", number: "466", city: "São Paulo", state: "SP", zip: "04534002"),
            "Rua Joaquim Floriano, 466 · São Paulo/SP · CEP 04534-002"
        )
        XCTAssertEqual(MoneyFormat.centsBRL(10_000).contains("100"), true)
        XCTAssertFalse(MoneyFormat.reais(10_000).contains(","))
        XCTAssertTrue(MoneyFormat.reais(79990).contains("799,90") || MoneyFormat.reais(79990).contains("799.90"))
    }

    func testSimulatorCopyAndCentRemainder() throws {
        let plan = try ContributionPlanMath.build(
            targetCents: 799_900,
            contributedCents: 0,
            startDate: "2026-11-19",
            endDate: "2027-02-19",
            frequency: .monthly
        )
        XCTAssertEqual(plan.installmentCount, 4)
        let three = try ContributionPlanMath.build(
            targetCents: 799_900,
            contributedCents: 0,
            startDate: "2026-01-01",
            endDate: "2026-01-03",
            frequency: .daily
        )
        XCTAssertEqual(three.amountPerInstallmentCents, 266_633)
        XCTAssertEqual(three.lastInstallmentCents, 266_634)
        XCTAssertEqual(PlanCopy.longDate("2027-02-19"), "19 de fev. de 2027")
        XCTAssertEqual(PlanCopy.rhythmLabel(.monthly, count: 5), "mensais")
        XCTAssertEqual(PlanCopy.periodLabel(.monthly), "por mês")
        XCTAssertEqual(PlanCopy.summary(plan, frequency: .monthly), "4 aportes mensais até 19 de fev. de 2027")
        XCTAssertEqual(PlanCopy.chip(iso: "2027-02-19").month, "fev")
        XCTAssertEqual(PlanCopy.dayMonth("2026-11-19"), "19 de nov")
        XCTAssertEqual(
            PlanCopy.calendarPayoff(health: .late, dues: []),
            "Tem aporte em atraso. Os dias ficam marcados."
        )
        XCTAssertEqual(PlanCopy.calendarPayoff(health: .onTrack, dues: []), "Você chega lá.")
        XCTAssertEqual(PlanCopy.depositPhrase(.pending), "a vencer")
    }

    func testGoalScheduleIgnoresPaymentsBeforeTheStart() throws {
        let schedule = try GoalScheduleMath.build(
            name: "iPhone",
            amountCents: 30_000,
            startDate: "2026-11-01",
            targetDate: "2027-01-01",
            frequency: .monthly,
            contributions: [
                PlanContribution(paidOn: "2026-10-01", amountCents: 50_000),
                PlanContribution(paidOn: "2026-11-01", amountCents: 15_000),
            ],
            today: "2026-11-15"
        )
        XCTAssertEqual(schedule.savedCents, 15_000)
        XCTAssertEqual(schedule.applied[0].paid, true)
        XCTAssertEqual(schedule.applied[1].dueCents, 5_000)
        XCTAssertEqual(schedule.applied[1].antecipado, true)
        XCTAssertEqual(schedule.applied[2].dueCents, 10_000)
        XCTAssertEqual(schedule.calendar.dues[1].note, "Antecipado")
        XCTAssertEqual(schedule.calendar.heroLabel, "Próximo aporte")
        let cells = GoalScheduleMath.monthCells(year: 2026, month: 11)
        XCTAssertEqual(cells[6], "2026-11-01")
        XCTAssertNil(cells[0])
    }
}

private extension Result where Failure == CoreFailure {
    var isFailure: Bool {
        if case .failure = self { return true }
        return false
    }
    var isSuccess: Bool {
        if case .success = self { return true }
        return false
    }
}
