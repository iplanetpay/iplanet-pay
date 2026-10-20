import IPlanetCore
import SwiftUI

struct GoalsView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router
    @State private var goals: [PaymentGoal] = []
    @State private var products: [Product] = []
    @State private var reservations: [ReservationRow] = []
    @State private var contributions: [Contribution] = []
    @State private var error: String?
    @State private var loading = true
    @State private var showSimulator = false
    @State private var selected: PaymentGoal?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Metas")
                        .font(.largeTitle.weight(.bold))
                    Text("Simule os aportes e acompanhe a subida.")
                        .foregroundStyle(Brand.inkMuted)
                    if let selected {
                        GoalDetail(
                            goal: selected,
                            reservation: reservations.first { $0.id == selected.reservationId },
                            contributions: contributions
                        ) {
                            self.selected = nil
                            router.goalID = nil
                        }
                    } else {
                        Button("Abrir simulador") { showSimulator = true }
                            .buttonStyle(PrimaryButtonStyle(fill: Brand.accent))
                        if let error { Text(error).foregroundStyle(Brand.danger) }
                        if loading { ProgressView() }
                        if goals.isEmpty && !loading {
                            EmptyPane(
                                title: "Nenhuma meta ainda",
                                message: "Simule os aportes e crie uma meta para acompanhar a subida."
                            )
                        }
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                            ForEach(goals) { goal in
                                let snapshot = GoalSnapshot.make(
                                    goal: goal,
                                    reservation: reservations.first { $0.id == goal.reservationId },
                                    contributions: contributions
                                )
                                Button {
                                    selected = goal
                                } label: {
                                    VStack(spacing: 8) {
                                        ProgressRing(percent: snapshot.percent, caption: "", size: 88)
                                        Text(goal.name)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(Brand.ink)
                                            .multilineTextAlignment(.center)
                                    }
                                    .frame(maxWidth: .infinity, minHeight: 44)
                                    .padding(.vertical, 8)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("\(goal.name), \(snapshot.status.label), \(Int(snapshot.percent.rounded()))%")
                            }
                        }
                    }
                }
                .padding(20)
            }
            .background(Brand.backgroundSubtle)
            .navigationTitle("Metas")
            .refreshable { await load() }
            .task { await load() }
            .onChange(of: router.goalID) { _, id in
                guard let id else { return }
                selected = goals.first { $0.id == id }
            }
            .sheet(isPresented: $showSimulator) {
                SimulatorSheet(products: products) {
                    showSimulator = false
                    Task { await load() }
                }
            }
        }
    }

    private func load() async {
        guard let userId = session.profile?.id else { return }
        loading = goals.isEmpty
        defer { loading = false }
        do {
            goals = try await Repository.goals(userId: userId)
            products = try await Repository.products()
            reservations = try await Repository.myReservations(userId: userId)
            contributions = try await Repository.myContributions(userId: userId)
            if let id = router.goalID {
                selected = goals.first { $0.id == id }
            }
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }
}

private struct GoalDetail: View {
    let goal: PaymentGoal
    let reservation: ReservationRow?
    let contributions: [Contribution]
    var onBack: () -> Void
    @State private var monthIndex = 0
    @State private var showAll = false

    var body: some View {
        let snapshot = GoalSnapshot.make(goal: goal, reservation: reservation, contributions: contributions)
        let health = goalHealth(snapshot.status)
        VStack(alignment: .leading, spacing: 16) {
            Button("Voltar") { onBack() }
                .frame(minHeight: 44)
            ClimbSceneView(percent: snapshot.percent, health: health)
            StatusPill(text: snapshot.status.label, tone: snapshot.tone)
            Text(goal.name).font(.title2.weight(.bold))
            Text(reservation?.product?.name ?? "Produto")
                .foregroundStyle(Brand.inkMuted)
            Text(snapshot.status.message)
            Text("\(Money.format(cents: snapshot.savedCents)) de \(Money.format(cents: snapshot.targetCents))")
                .font(.headline)
            sidePanel(snapshot)
            if let plan = snapshot.plan {
                calendar(plan: plan, snapshot: snapshot)
            }
        }
    }

    private func goalHealth(_ status: ClimbStatus) -> GoalHealth {
        switch status {
        case .onTrack: .onTrack
        case .nearLate: .nearLate
        case .late: .late
        case .done: .complete
        }
    }

    private func sidePanel(_ snapshot: GoalSnapshot) -> some View {
        let remaining = max(0, snapshot.targetCents - snapshot.savedCents)
        let next = snapshot.plan.flatMap { plan in
            let rows = ContributionPlanMath.applyEarlyPayments(
                installments: plan.dates.enumerated().map { index, date in
                    let cents = (try? ContributionPlanMath.installmentCentsAt(plan, index: index)) ?? plan.amountPerInstallmentCents
                    return (dueDate: date, amountCents: cents)
                },
                contributions: snapshot.contributions
            )
            return rows.first { !$0.paid }
        }
        return BrandCard {
            VStack(alignment: .leading, spacing: 10) {
                row("Falta para concluir", snapshot.status == .done ? "R$ 0" : Money.format(cents: remaining))
                if let next, snapshot.status != .done {
                    row(
                        snapshot.status == .late ? "Aporte em atraso" : "Próximo aporte",
                        "\(next.dueDate) · \(Money.format(cents: next.dueCents))"
                    )
                    Text(ClimbLogic.relativeDue(next.dueDate, today: CivilDate.calendarToday()))
                        .font(.caption)
                        .foregroundStyle(Brand.inkMuted)
                } else {
                    row(snapshot.status == .late ? "Aporte em atraso" : "Próximo aporte", "—")
                }
            }
        }
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title).foregroundStyle(Brand.inkMuted)
            Spacer()
            Text(value).fontWeight(.semibold)
        }
    }

    private func calendar(plan: ContributionPlan, snapshot: GoalSnapshot) -> some View {
        let today = CivilDate.calendarToday()
        let slots = GoalCalendarMath.resolveSlots(dates: plan.dates, today: today, contributions: snapshot.contributions)
        let months = GoalCalendarMath.planMonthKeys(plan.dates)
        let upcoming = slots.first { $0.status == .upcoming }?.dueDate
        let index = months.isEmpty ? 0 : min(monthIndex, months.count - 1)
        let visible = showAll ? months : (months.isEmpty ? [] : [months[index]])
        return BrandCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Calendário de aportes").font(.headline)
                if months.count > 1 {
                    HStack {
                        Button("Mês anterior") {
                            monthIndex = GoalCalendarMath.stepMonthIndex(index, delta: -1, count: months.count)
                        }
                        .frame(minHeight: 44)
                        Spacer()
                        Button("Próximo mês") {
                            monthIndex = GoalCalendarMath.stepMonthIndex(index, delta: 1, count: months.count)
                        }
                        .frame(minHeight: 44)
                    }
                    Button(showAll ? "Mostrar um mês" : "Mostrar todos") { showAll.toggle() }
                        .frame(minHeight: 44)
                }
                ForEach(visible, id: \.self) { month in
                    Text(month).font(.subheadline.weight(.semibold))
                    ForEach(slots.filter { $0.dueDate.hasPrefix(month) }, id: \.dueDate) { slot in
                        HStack {
                            Text(slot.dueDate)
                            Spacer()
                            Text(slot.status.label)
                                .foregroundStyle(Brand.inkMuted)
                        }
                        .font(.subheadline)
                    }
                }
            }
        }
        .onAppear {
            monthIndex = GoalCalendarMath.defaultMonthIndex(months: months, today: today, upcomingDate: upcoming)
        }
    }
}
