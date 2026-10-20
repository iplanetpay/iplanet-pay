import SwiftUI

struct GoalsView: View {
    @Environment(SessionStore.self) private var session
    @State private var goals: [PaymentGoal] = []
    @State private var products: [Product] = []
    @State private var error: String?
    @State private var loading = true
    @State private var showSimulator = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Metas de aporte")
                        .font(.largeTitle.weight(.bold))
                    Text("Calcule o valor de cada aporte e acompanhe a meta do produto.")
                        .foregroundStyle(Brand.inkMuted)
                    Button("Abrir simulador") { showSimulator = true }
                        .buttonStyle(PrimaryButtonStyle())
                    if let error { Text(error).foregroundStyle(Brand.danger) }
                    if loading { ProgressView() }
                    if goals.isEmpty && !loading {
                        EmptyPane(title: "Nenhuma meta", message: "Use o simulador para criar a meta de um produto do catálogo.")
                    }
                    ForEach(goals) { goal in
                        BrandCard {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(goal.name).font(.headline)
                                    Spacer()
                                    StatusPill(text: goal.status, tone: goal.status == "active" ? .accent : .neutral)
                                }
                                Text("\(goal.installmentsCount)x de \(Money.format(cents: goal.installmentCents))")
                                Text("Alvo \(Money.format(cents: goal.amountCents)) · até \(goal.targetDate)")
                                    .font(.subheadline)
                                    .foregroundStyle(Brand.inkMuted)
                                if goal.status == "active" {
                                    Button("Pausar") {
                                        Task { await setStatus(goal, "paused") }
                                    }
                                    .font(.subheadline.weight(.semibold))
                                }
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
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }

    private func setStatus(_ goal: PaymentGoal, _ status: String) async {
        guard let userId = session.profile?.id else { return }
        do {
            try await Repository.setGoalStatus(id: goal.id, userId: userId, status: status)
            await load()
        } catch {
            self.error = describeError(error)
        }
    }
}

struct SimulatorSheet: View {
    let products: [Product]
    var onDone: () -> Void
    @Environment(SessionStore.self) private var session
    @State private var productId: UUID?
    @State private var installments = 10
    @State private var target = Calendar.current.date(byAdding: .month, value: 10, to: Date()) ?? Date()
    @State private var phone = ""
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Picker("Produto", selection: $productId) {
                    Text("Escolha").tag(Optional<UUID>.none)
                    ForEach(products) { product in
                        Text(product.name).tag(Optional(product.id))
                    }
                }
                Stepper("Parcelas: \(installments)", value: $installments, in: 1...60)
                DatePicker("Data alvo", selection: $target, displayedComponents: .date)
                if let product = selected {
                    Text("Cada aporte: \(Money.format(cents: installment(for: product)))")
                        .font(.headline)
                    Text("Total \(Money.format(cents: product.listPriceCents))")
                        .foregroundStyle(Brand.inkMuted)
                }
                TextField("WhatsApp (opcional)", text: $phone)
                if let message { Text(message).foregroundStyle(Brand.danger) }
                Button(busy ? "Salvando…" : "Salvar meta") {
                    Task { await save() }
                }
                .disabled(busy || productId == nil)
            }
            .navigationTitle("Simulador")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { onDone() }
                }
            }
            .onAppear {
                if productId == nil { productId = products.first?.id }
                phone = session.profile?.phone ?? ""
            }
        }
    }

    private var selected: Product? {
        products.first { $0.id == productId }
    }

    private func installment(for product: Product) -> Int {
        let count = max(1, installments)
        return Int(ceil(Double(product.listPriceCents) / Double(count)))
    }

    private func save() async {
        guard let userId = session.profile?.id, let product = selected else { return }
        busy = true
        defer { busy = false }
        let day = Calendar.current.component(.day, from: target)
        let draft = GoalDraft(
            existingId: nil,
            userId: userId,
            productId: product.id,
            reservationId: nil,
            name: product.name,
            targetDate: DatesPT.isoDay(target),
            reminderDay: min(30, max(1, day)),
            amountCents: product.listPriceCents,
            installmentCents: installment(for: product),
            installmentsCount: installments,
            frequency: "monthly",
            planStartDate: DatesPT.isoDay(Date()),
            whatsappPhone: BrazilPhone.normalize(phone)
        )
        do {
            try await Repository.saveGoal(draft)
            onDone()
        } catch {
            message = describeError(error)
        }
    }
}
