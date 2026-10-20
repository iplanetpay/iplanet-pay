import IPlanetCore
import SwiftUI

struct SimulatorLock: Sendable {
    var reservationId: UUID
    var productId: UUID
    var productName: String
    var listPriceCents: Int
    var contributedCents: Int
}

struct GoalSnapshot: Sendable {
    var status: ClimbStatus
    var savedCents: Int
    var targetCents: Int
    var percent: Double
    var plan: ContributionPlan?
    var contributions: [PlanContribution]
    var tone: StatusPill.PillTone

    static func make(goal: PaymentGoal, reservation: ReservationRow?, contributions: [Contribution]) -> GoalSnapshot {
        let target = reservation?.listPriceCents ?? goal.amountCents
        let saved = reservation?.amountPaidCents ?? 0
        let percent = target > 0 ? min(100, Double(saved) / Double(target) * 100) : 0
        let start = goal.planStartDate ?? CivilDate.calendarToday()
        let paid = GoalCalendarMath.goalContributions(
            contributions.compactMap { item -> PlanContribution? in
                guard item.status == "confirmed" else { return nil }
                let day = CivilDay.string(from: item.confirmedAt ?? item.createdAt ?? Date())
                return PlanContribution(paidOn: day, amountCents: item.amountCents)
            },
            startDate: start
        )
        let frequency = ContributionFrequency(rawValue: goal.frequency ?? "monthly") ?? .monthly
        let plan = try? ContributionPlanMath.build(
            targetCents: Double(target),
            contributedCents: Double(saved),
            startDate: start,
            endDate: goal.targetDate,
            frequency: frequency
        )
        let deposits = (plan?.dates ?? []).map { date -> ClimbDeposit in
            let slots = GoalCalendarMath.resolveSlots(dates: plan?.dates ?? [], today: CivilDate.calendarToday(), contributions: paid)
            let status = slots.first { $0.dueDate == date }?.status
            switch status {
            case .onTime: return ClimbDeposit(status: .paidOnTime, dueDate: date)
            case .latePayment: return ClimbDeposit(status: .paidLate, dueDate: date)
            case .missed: return ClimbDeposit(status: .missed, dueDate: date)
            case .upcoming, nil: return ClimbDeposit(status: .pending, dueDate: date)
            }
        }
        let climb = ClimbLogic.deriveStatus(deposits: deposits, percent: percent, today: CivilDate.calendarToday())
        let tone: StatusPill.PillTone
        switch climb {
        case .onTrack: tone = .success
        case .nearLate: tone = .lavender
        case .late: tone = .danger
        case .done: tone = .accent
        }
        return GoalSnapshot(status: climb, savedCents: saved, targetCents: target, percent: percent, plan: plan, contributions: paid, tone: tone)
    }
}

struct SimulatorSheet: View {
    let products: [Product]
    var locked: SimulatorLock?
    var onDone: () -> Void
    @Environment(SessionStore.self) private var session
    @State private var name = ""
    @State private var productId: UUID?
    @State private var startDate = CivilDate.calendarToday()
    @State private var targetDate = ""
    @State private var frequency: ContributionFrequency = .monthly
    @State private var simulated = false
    @State private var plan: ContributionPlan?
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Simulador de aportes")
                        .font(.title.weight(.bold))
                    Text("Escolha o ritmo. O valor de cada aporte aparece para fechar o produto na data combinada.")
                        .foregroundStyle(Brand.inkMuted)
                    labeled("Nome da meta") {
                        TextField("Ex.: iPhone até o fim do ano", text: $name)
                            .textFieldStyle(.plain)
                    }
                    labeled(locked == nil ? "Selecionar um produto do catálogo" : "Produto") {
                        if let locked {
                            Text(locked.productName)
                        } else {
                            Picker("Produto", selection: $productId) {
                                Text("Escolha").tag(Optional<UUID>.none)
                                ForEach(products) { product in
                                    Text(product.name).tag(Optional(product.id))
                                }
                            }
                        }
                    }
                    labeled("Data de início") {
                        TextField("aaaa-mm-dd", text: $startDate)
                            .textFieldStyle(.plain)
                    }
                    Text("Os aportes começam neste dia.")
                        .font(.caption)
                        .foregroundStyle(Brand.inkMuted)
                    labeled("Data para concluir") {
                        TextField("aaaa-mm-dd", text: $targetDate)
                            .textFieldStyle(.plain)
                    }
                    Text("Precisa ser depois da data de início.")
                        .font(.caption)
                        .foregroundStyle(Brand.inkMuted)
                    Text("Frequência").font(.subheadline.weight(.semibold))
                    HStack {
                        frequencyButton(.daily, "Diário")
                        frequencyButton(.weekly, "Semanal")
                        frequencyButton(.monthly, "Mensal")
                    }
                    Button("Simular") { simulate() }
                        .buttonStyle(PrimaryButtonStyle())
                    if let message {
                        Text(message).foregroundStyle(Brand.danger)
                    }
                    if let plan {
                        result(plan)
                        Button(busy ? "Criando meta..." : "Criar meta") {
                            Task { await create(plan) }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(busy || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
                .padding(20)
            }
            .background(Brand.backgroundSubtle)
            .navigationTitle("Simulador")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { onDone() }
                }
            }
            .onAppear {
                if let locked {
                    productId = locked.productId
                    name = locked.productName
                } else if productId == nil {
                    productId = products.first?.id
                }
            }
        }
    }

    private func labeled<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline.weight(.semibold))
            content()
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Brand.background)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    private func frequencyButton(_ value: ContributionFrequency, _ title: String) -> some View {
        Button(title) { frequency = value }
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(frequency == value ? Brand.accentSoft : Brand.background)
            .foregroundStyle(Brand.ink)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(frequency == value ? Brand.accent : Brand.line, lineWidth: 1)
            )
            .accessibilityAddTraits(frequency == value ? .isSelected : AccessibilityTraits())
    }

    private func simulate() {
        message = nil
        simulated = true
        let target = locked?.listPriceCents ?? products.first { $0.id == productId }?.listPriceCents ?? 0
        let contributed = locked?.contributedCents ?? 0
        do {
            let built = try ContributionPlanMath.build(
                targetCents: Double(target),
                contributedCents: Double(contributed),
                startDate: startDate.trimmingCharacters(in: .whitespacesAndNewlines),
                endDate: targetDate.trimmingCharacters(in: .whitespacesAndNewlines),
                frequency: frequency
            )
            if built.remainingCents <= 0 {
                plan = nil
                message = "Não há valor restante para aportar."
            } else {
                plan = built
            }
        } catch {
            plan = nil
            message = describeError(error)
        }
    }

    @ViewBuilder
    private func result(_ plan: ContributionPlan) -> some View {
        BrandCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(rhythm(plan))
                    .font(.headline)
                Text("\(Money.format(cents: plan.amountPerInstallmentCents)) por aporte")
                    .font(.title2.weight(.bold))
                if plan.lastInstallmentCents != plan.amountPerInstallmentCents {
                    Text("Último aporte \(Money.format(cents: plan.lastInstallmentCents))")
                        .foregroundStyle(Brand.inkMuted)
                }
                Text("De \(plan.dates.first ?? startDate) até \(plan.dates.last ?? targetDate)")
                    .font(.subheadline)
                    .foregroundStyle(Brand.inkMuted)
            }
        }
    }

    private func rhythm(_ plan: ContributionPlan) -> String {
        let count = plan.installmentCount
        switch frequency {
        case .daily: count == 1 ? "1 dia" : "\(count) dias"
        case .weekly: count == 1 ? "1 semana" : "\(count) semanas"
        case .monthly: count == 1 ? "1 mês" : "\(count) meses"
        }
    }

    private func create(_ plan: ContributionPlan) async {
        guard let userId = session.profile?.id, let productId else { return }
        busy = true
        defer { busy = false }
        let draft = GoalDraft(
            existingId: nil,
            userId: userId,
            productId: productId,
            reservationId: locked?.reservationId,
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            targetDate: targetDate.trimmingCharacters(in: .whitespacesAndNewlines),
            reminderDay: nil,
            amountCents: locked?.listPriceCents ?? plan.remainingCents,
            installmentCents: plan.amountPerInstallmentCents,
            installmentsCount: plan.installmentCount,
            frequency: frequency.rawValue,
            planStartDate: startDate.trimmingCharacters(in: .whitespacesAndNewlines),
            whatsappPhone: nil
        )
        do {
            try await Repository.saveGoal(draft)
            onDone()
        } catch {
            message = describeError(error)
        }
    }
}

struct ClimbSceneView: View {
    let percent: Double
    let health: GoalHealth
    @State private var phase = false

    var body: some View {
        let weather = ClimbJourney.journeyWeather(health: health, hour: hour, external: nil)
        TimelineView(.animation) { timeline in
            let wobble = sin(timeline.date.timeIntervalSinceReferenceDate * 1.4)
            Canvas { context, size in
                let sky = weather.phase == .night ? Color(red: 0.08, green: 0.12, blue: 0.22) : Color(red: 0.78, green: 0.88, blue: 0.98)
                context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(sky))
                var ridge = Path()
                ridge.move(to: CGPoint(x: 0, y: size.height * 0.92))
                ridge.addLine(to: CGPoint(x: size.width * 0.18, y: size.height * 0.72))
                ridge.addLine(to: CGPoint(x: size.width * 0.42, y: size.height * 0.8))
                ridge.addLine(to: CGPoint(x: size.width * 0.7, y: size.height * 0.48))
                ridge.addLine(to: CGPoint(x: size.width, y: size.height * 0.62))
                ridge.addLine(to: CGPoint(x: size.width, y: size.height))
                ridge.addLine(to: CGPoint(x: 0, y: size.height))
                context.fill(ridge, with: .color(Color(red: 0.55, green: 0.62, blue: 0.7)))
                let point = ClimbJourney.trailPoint(percent / 100)
                let x = point.x / 560 * size.width
                let y = point.y / 360 * size.height + wobble * 3
                let motion = ClimbJourney.climbMotion(health)
                let radius: CGFloat = motion == .celebrate ? 16 : 12
                let body = CGRect(x: x - radius, y: y - radius * 2, width: radius * 2, height: radius * 2.4)
                context.fill(Path(ellipseIn: body), with: .color(Brand.accent))
            }
            .animation(.spring(response: 0.6, dampingFraction: 0.8), value: phase)
        }
        .frame(height: 280)
        .clipShape(RoundedRectangle(cornerRadius: Brand.cardRadius, style: .continuous))
        .accessibilityLabel("Cena da meta, \(Int(percent.rounded())) por cento")
        .onAppear { phase = true }
    }

    private var hour: Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = CivilDay.zone
        return calendar.component(.hour, from: Date())
    }
}
