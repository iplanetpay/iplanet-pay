import IPlanetCore
import SwiftUI

struct SimulatorLock: Sendable {
    var reservationId: UUID
    var productId: UUID
    var productName: String
    var listPriceCents: Int
    var contributedCents: Int
}

enum GoalLinks {
    static func paid(_ contributions: [Contribution]) -> [PlanContribution] {
        contributions.compactMap { item in
            guard item.status == "confirmed" else { return nil }
            let day = CivilDay.string(from: item.confirmedAt ?? item.createdAt ?? Date())
            return PlanContribution(paidOn: day, amountCents: item.amountCents)
        }
    }

    static func schedule(
        goal: PaymentGoal,
        contributions: [Contribution],
        today: String = CivilDate.calendarToday()
    ) -> GoalSchedule? {
        let frequency = ContributionFrequency(rawValue: goal.frequency ?? "monthly") ?? .monthly
        let start = goal.planStartDate ?? today
        // Só os aportes da reserva desta meta contam (antes somava os de todas as reservas).
        let own = GoalAporte.contributions(contributions, reservationId: goal.reservationId) { $0.reservationId }
        return try? GoalScheduleMath.build(
            name: goal.name,
            amountCents: goal.amountCents,
            startDate: start,
            targetDate: goal.targetDate,
            frequency: frequency,
            contributions: paid(own),
            today: today
        )
    }
}

struct GoalSnapshot: Sendable {
    var status: ClimbStatus
    var savedCents: Int
    var targetCents: Int
    var percent: Double
    var plan: ContributionPlan?
    var contributions: [PlanContribution]
    var tone: StatusPill.PillTone
    var schedule: GoalSchedule?

    static func make(goal: PaymentGoal, reservation _: ReservationRow?, contributions: [Contribution]) -> GoalSnapshot {
        let schedule = GoalLinks.schedule(goal: goal, contributions: contributions)
        let percent = Double(schedule?.progressPercent ?? 0)
        let deposits = (schedule?.slots ?? []).map { slot -> ClimbDeposit in
            switch slot.status {
            case .onTime: return ClimbDeposit(status: .paidOnTime, dueDate: slot.dueDate)
            case .latePayment: return ClimbDeposit(status: .paidLate, dueDate: slot.dueDate)
            case .missed: return ClimbDeposit(status: .missed, dueDate: slot.dueDate)
            case .upcoming: return ClimbDeposit(status: .pending, dueDate: slot.dueDate)
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
        return GoalSnapshot(
            status: climb,
            savedCents: schedule?.savedCents ?? 0,
            targetCents: goal.amountCents,
            percent: percent,
            plan: schedule?.plan,
            contributions: schedule?.contributions ?? [],
            tone: tone,
            schedule: schedule
        )
    }
}

struct SimulatorSheet: View {
    var locked: SimulatorLock?
    var priorPayments: [PlanContribution] = []
    var onDone: (UUID?) -> Void
    @Environment(SessionStore.self) private var session
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var catalog: [Product]
    @State private var name = ""
    @State private var productId: UUID?
    @State private var startDate = CivilDate.calendarToday()
    @State private var targetDate = ""
    @State private var frequency: ContributionFrequency = .monthly
    @State private var plan: ContributionPlan?
    @State private var contributedCents = 0
    @State private var targetCents = 0
    @State private var message: String?
    @State private var busy = false
    @State private var created: GoalSchedule?
    @State private var createdReservation: UUID?

    init(products: [Product], locked: SimulatorLock? = nil, priorPayments: [PlanContribution] = [], onDone: @escaping (UUID?) -> Void) {
        self.locked = locked
        self.priorPayments = priorPayments
        self.onDone = onDone
        _catalog = State(initialValue: products)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Simulador de aportes")
                        .font(.title.weight(.bold))
                    Text("Escolha o ritmo. O valor de cada aporte aparece para fechar o produto na data combinada.")
                        .foregroundStyle(Brand.inkMuted)
                    if created == nil {
                        form
                    }
                    if let message {
                        Text(message).foregroundStyle(Brand.danger)
                    }
                    if let created {
                        ContributionCalendarView(data: created.calendar)
                        if createdReservation != nil {
                            Button("Ver reserva") {
                                Haptics.tap()
                                onDone(createdReservation)
                            }
                            .buttonStyle(PrimaryButtonStyle(fill: Brand.accent))
                        }
                    } else if let plan {
                        SimulatorPayoff(
                            plan: plan,
                            frequency: frequency,
                            contributedCents: contributedCents,
                            targetCents: targetCents,
                            saving: busy,
                            reduceMotion: reduceMotion
                        ) {
                            Task { await create(plan) }
                        }
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
                .padding(20)
                .animation(.spring(response: 0.5, dampingFraction: 0.86), value: revealToken)
            }
            .background(Brand.backgroundSubtle)
            .navigationTitle("Simulador")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { onDone(nil) }
                }
            }
            .task { await prepare() }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 16) {
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
                        ForEach(catalog) { product in
                            Text(product.name).tag(Optional(product.id))
                        }
                    }
                    .pickerStyle(.menu)
                }
            }
            labeled("Data de início") {
                TextField("aaaa-mm-dd", text: $startDate)
                    .textFieldStyle(.plain)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            Text("Os aportes começam neste dia.")
                .font(.caption)
                .foregroundStyle(Brand.inkMuted)
            labeled("Data para concluir") {
                TextField("aaaa-mm-dd", text: $targetDate)
                    .textFieldStyle(.plain)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
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
        Button(title) {
            frequency = value
            Haptics.tap()
        }
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

    private var revealToken: String {
        if created != nil { return "created" }
        return plan?.dates.joined(separator: ",") ?? "form"
    }

    private func prepare() async {
        if catalog.isEmpty {
            catalog = (try? await Repository.products()) ?? []
        }
        if let locked {
            productId = locked.productId
            if name.isEmpty { name = locked.productName }
        } else if productId == nil {
            productId = catalog.first?.id
        }
    }

    private func simulate() {
        message = nil
        created = nil
        Haptics.tap()
        let start = startDate.trimmingCharacters(in: .whitespacesAndNewlines)
        let end = targetDate.trimmingCharacters(in: .whitespacesAndNewlines)
        let today = CivilDate.calendarToday()
        if start < today {
            plan = nil
            message = "A data de início precisa ser hoje ou uma data futura."
            return
        }
        let price = locked?.listPriceCents ?? catalog.first { $0.id == productId }?.listPriceCents ?? 0
        let contributed = locked?.contributedCents ?? 0
        guard price > 0, productId != nil else {
            plan = nil
            message = "Escolha um produto do catálogo."
            return
        }
        do {
            let built = try ContributionPlanMath.build(
                targetCents: Double(price),
                contributedCents: Double(contributed),
                startDate: start,
                endDate: end,
                frequency: frequency
            )
            if built.remainingCents <= 0 {
                plan = nil
                message = "Não há valor restante para aportar."
            } else {
                targetCents = price
                contributedCents = contributed
                plan = built
            }
        } catch {
            plan = nil
            message = describeError(error)
        }
    }

    private func create(_ plan: ContributionPlan) async {
        guard let userId = session.profile?.id, let productId else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            message = "Dê um nome para a meta."
            return
        }
        busy = true
        defer { busy = false }
        let start = startDate.trimmingCharacters(in: .whitespacesAndNewlines)
        let end = targetDate.trimmingCharacters(in: .whitespacesAndNewlines)
        let draft = GoalDraft(
            existingId: nil,
            userId: userId,
            productId: productId,
            reservationId: locked?.reservationId,
            name: trimmed,
            targetDate: end,
            reminderDay: nil,
            amountCents: plan.remainingCents,
            installmentCents: plan.amountPerInstallmentCents > 0 ? plan.amountPerInstallmentCents : plan.lastInstallmentCents,
            installmentsCount: plan.installmentCount,
            frequency: frequency.rawValue,
            planStartDate: start,
            whatsappPhone: nil
        )
        do {
            let saved = try await Repository.saveGoal(draft)
            let schedule = try GoalScheduleMath.build(
                name: trimmed,
                amountCents: plan.remainingCents,
                startDate: start,
                targetDate: end,
                frequency: frequency,
                contributions: priorPayments,
                today: CivilDate.calendarToday()
            )
            createdReservation = saved.reservationId
            created = schedule
            Haptics.success()
        } catch {
            message = describeError(error)
        }
    }
}

private struct SimulatorPayoff: View {
    let plan: ContributionPlan
    let frequency: ContributionFrequency
    let contributedCents: Int
    let targetCents: Int
    let saving: Bool
    let reduceMotion: Bool
    var onCreate: () -> Void
    @State private var ring: Double
    @State private var shownChips = 0

    init(
        plan: ContributionPlan,
        frequency: ContributionFrequency,
        contributedCents: Int,
        targetCents: Int,
        saving: Bool,
        reduceMotion: Bool,
        onCreate: @escaping () -> Void
    ) {
        self.plan = plan
        self.frequency = frequency
        self.contributedCents = contributedCents
        self.targetCents = targetCents
        self.saving = saving
        self.reduceMotion = reduceMotion
        self.onCreate = onCreate
        let paid = targetCents > 0 ? Double(contributedCents) / Double(targetCents) * 100 : 0
        _ring = State(initialValue: reduceMotion ? 100 : paid)
        _shownChips = State(initialValue: reduceMotion ? min(8, plan.dates.count) : 0)
    }

    var body: some View {
        let preview = Array(plan.dates.prefix(8))
        let hidden = plan.dates.count - preview.count
        let hero = plan.amountPerInstallmentCents > 0 ? plan.amountPerInstallmentCents : plan.lastInstallmentCents
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .center, spacing: 16) {
                ZStack {
                    Circle().stroke(Color.white, lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: max(0, min(1, ring / 100)))
                        .stroke(Brand.accent, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text("\(Int(ring.rounded()))%")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(Brand.ink)
                            .contentTransition(.numericText())
                        Text("projeção")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.2)
                            .textCase(.uppercase)
                            .foregroundStyle(Brand.inkMuted)
                    }
                }
                .frame(width: 112, height: 112)
                .animation(reduceMotion ? nil : .spring(response: 1.05, dampingFraction: 0.86), value: ring)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Valor por aporte · \(PlanCopy.periodLabel(frequency))")
                        .font(.caption.weight(.semibold))
                        .tracking(1.1)
                        .textCase(.uppercase)
                        .foregroundStyle(Brand.accent)
                    Text(Money.format(cents: hero))
                        .font(.largeTitle.weight(.bold))
                        .contentTransition(.numericText())
                    Text(PlanCopy.summary(plan, frequency: frequency))
                        .font(.subheadline)
                        .foregroundStyle(Brand.inkMuted)
                    Text("Você chega lá.")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Brand.accent)
                    if contributedCents > 0 {
                        Text("Já aportado \(Money.format(cents: contributedCents)). O plano cobre os \(Money.format(cents: plan.remainingCents)) restantes.")
                            .font(.subheadline)
                            .foregroundStyle(Brand.inkMuted)
                    }
                    if plan.lastInstallmentCents != plan.amountPerInstallmentCents {
                        Text("O último aporte fica em \(Money.format(cents: plan.lastInstallmentCents)) para fechar os centavos.")
                            .font(.subheadline)
                            .foregroundStyle(Brand.inkMuted)
                    }
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Sequência")
                    .font(.caption.weight(.semibold))
                    .tracking(1.1)
                    .textCase(.uppercase)
                    .foregroundStyle(Brand.inkMuted)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(preview.enumerated()), id: \.offset) { index, date in
                            let chip = PlanCopy.chip(iso: date)
                            VStack(spacing: 0) {
                                Text(chip.day).font(.subheadline.weight(.bold))
                                Text(chip.month).font(.caption2).textCase(.uppercase).foregroundStyle(Brand.inkMuted)
                            }
                            .frame(width: 56, height: 56)
                            .background(Brand.background)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Brand.line, lineWidth: 1))
                            .opacity(index < shownChips ? 1 : 0)
                            .offset(y: index < shownChips ? 0 : 8)
                        }
                        if hidden > 0 {
                            Text("+\(hidden)")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Brand.inkMuted)
                                .frame(width: 56, height: 56)
                                .background(Brand.background)
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                    }
                }
            }
            Button(saving ? "Criando meta..." : "Criar meta") { onCreate() }
                .buttonStyle(PrimaryButtonStyle(fill: Brand.accent))
                .disabled(saving)
        }
        .padding(20)
        .background(Brand.backgroundSubtle)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Brand.line, lineWidth: 1))
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.spring(response: 1.05, dampingFraction: 0.86)) {
                ring = 100
            }
        }
        .task {
            guard !reduceMotion, preview.count > 0 else { return }
            for index in 1...preview.count {
                if Task.isCancelled { return }
                try? await Task.sleep(for: .milliseconds(45))
                if Task.isCancelled { return }
                withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
                    shownChips = index
                }
            }
        }
    }
}
