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
                    Button("Abrir simulador") { showSimulator = true }
                        .buttonStyle(PrimaryButtonStyle(fill: Brand.accent))
                    if let error { Text(error).foregroundStyle(Brand.danger) }
                    if loading { LoadingSkeleton(lines: 4) }
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
                                    ProgressRing(percent: snapshot.percent, caption: "", size: 88, numberColor: .black)
                                    Text(goal.name)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.black)
                                        .multilineTextAlignment(.center)
                                }
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .padding(.vertical, 12)
                                .background(Brand.background)
                                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                                        .stroke(Brand.line, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(goal.name), \(snapshot.status.label), \(Int(snapshot.percent.rounded()))%")
                        }
                    }
                }
                .padding(20)
            }
            .background(Brand.backgroundSubtle)
            .navigationTitle("Metas")
            .navigationDestination(item: $selected) { goal in
                GoalDetail(
                    goal: goal,
                    reservation: reservations.first { $0.id == goal.reservationId },
                    contributions: contributions
                )
            }
            .refreshable { await load() }
            .task { await load() }
            .onChange(of: router.goalID) { _, id in
                guard let id, let goal = goals.first(where: { $0.id == id }) else { return }
                selected = goal
                router.goalID = nil
            }
            .sheet(isPresented: $showSimulator) {
                SimulatorSheet(products: products) { reservationId in
                    showSimulator = false
                    if let reservationId {
                        router.reservationID = reservationId
                        router.selectedTab = .home
                    }
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
            if let id = router.goalID, let goal = goals.first(where: { $0.id == id }) {
                selected = goal
                router.goalID = nil
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
    @Environment(AppRouter.self) private var router

    var body: some View {
        let snapshot = GoalSnapshot.make(goal: goal, reservation: reservation, contributions: contributions)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let schedule = snapshot.schedule {
                    RocketSceneView(
                        schedule: schedule,
                        productName: reservation?.product?.name ?? "Produto"
                    ) {
                        guard let reservationId = goal.reservationId else { return }
                        router.requestPixReservationID = reservationId
                        router.reservationID = reservationId
                        router.selectedTab = .home
                        router.goalID = nil
                    }
                    ContributionCalendarView(data: schedule.calendar)
                } else {
                    Text("Não foi possível montar o calendário desta meta.")
                        .foregroundStyle(Brand.danger)
                }
            }
            .padding(20)
        }
        .background(Brand.backgroundSubtle)
        .navigationTitle(goal.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
