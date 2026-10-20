import SwiftUI

struct AdminView: View {
    @Environment(SessionStore.self) private var session
    @State private var tab: AdminTab = .overview

    var body: some View {
        TabView(selection: $tab) {
            AdminOverview()
                .tabItem { Label("Painel", systemImage: "chart.bar") }
                .tag(AdminTab.overview)
            AdminReservations()
                .tabItem { Label("Reservas", systemImage: "shippingbox") }
                .tag(AdminTab.reservations)
            AdminClients()
                .tabItem { Label("Clientes", systemImage: "person.2") }
                .tag(AdminTab.clients)
            AdminProducts()
                .tabItem { Label("Produtos", systemImage: "ipad.and.iphone") }
                .tag(AdminTab.products)
            AdminNotices()
                .tabItem { Label("Avisos", systemImage: "megaphone") }
                .tag(AdminTab.notices)
        }
        .tint(Brand.accent)
    }
}

private enum AdminTab: Hashable {
    case overview
    case reservations
    case clients
    case products
    case notices
}

private struct AdminOverview: View {
    @Environment(SessionStore.self) private var session
    @State private var reservations: [ReservationRow] = []
    @State private var pending: [Contribution] = []
    @State private var closings: [FinancialClosing] = []
    @State private var draws: [RaffleDraw] = []
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button("Abrir área do cliente") { session.prefersClientShell = true }
                    Button("Sair", role: .destructive) { Task { await session.signOut() } }
                }
                Section("Agora") {
                    LabeledContent("Reservas listadas", value: "\(reservations.count)")
                    LabeledContent("Ativas", value: "\(reservations.filter { $0.status == "ativa" }.count)")
                    LabeledContent("Aportes pendentes", value: "\(pending.count)")
                }
                Section("Aportes pendentes") {
                    ForEach(pending) { item in
                        HStack {
                            Text(Money.format(cents: item.amountCents))
                            Spacer()
                            Button("Confirmar") { Task { await confirm(item) } }
                        }
                    }
                }
                Section("Fechamentos") {
                    if closings.isEmpty { Text("Nenhum fechamento.") }
                    ForEach(closings) { closing in
                        VStack(alignment: .leading) {
                            Text("\(closing.periodStart) – \(closing.periodEnd)")
                            Text("Líquido \(Money.format(cents: closing.netCents))")
                                .font(.caption)
                                .foregroundStyle(Brand.inkMuted)
                        }
                    }
                }
                Section("Sorteios") {
                    ForEach(draws) { draw in
                        Text(draw.winnerName ?? "Sorteio")
                    }
                }
                if let error { Text(error).foregroundStyle(Brand.danger) }
            }
            .navigationTitle("Admin")
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        do {
            reservations = try await Repository.reservations(limit: 100)
            pending = try await Repository.pendingContributions()
            closings = try await Repository.closings()
            draws = try await Repository.raffleDraws()
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }

    private func confirm(_ item: Contribution) async {
        do {
            try await Repository.adminConfirmContribution(id: item.id)
            await load()
        } catch {
            self.error = describeError(error)
        }
    }
}

private struct AdminReservations: View {
    @State private var rows: [ReservationRow] = []
    @State private var names: [UUID: String] = [:]
    @State private var error: String?
    @State private var selected: UUID?

    var body: some View {
        NavigationStack {
            List(rows) { row in
                Button {
                    selected = row.id
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.product?.name ?? "Reserva")
                            .font(.headline)
                            .foregroundStyle(Brand.ink)
                        Text(names[row.userId] ?? "Cliente")
                            .font(.caption)
                            .foregroundStyle(Brand.inkMuted)
                        Text("\(row.statusLabel) · \(Money.format(cents: row.amountPaidCents))")
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Reservas")
            .navigationDestination(item: $selected) { id in
                ReservationDetailView(reservationID: id)
            }
            .refreshable { await load() }
            .task { await load() }
            .safeAreaInset(edge: .bottom) {
                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.white)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(Brand.danger)
                }
            }
        }
    }

    private func load() async {
        do {
            rows = try await Repository.reservations(limit: 100)
            let people = try await Repository.profiles(ids: Array(Set(rows.map(\.userId))))
            names = Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0.displayName) })
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }
}

private struct AdminClients: View {
    @State private var query = ""
    @State private var rows: [Profile] = []
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List(rows) { profile in
                VStack(alignment: .leading, spacing: 6) {
                    Text(profile.displayName).font(.headline)
                    Text(profile.userRole.rawValue)
                        .font(.caption)
                        .foregroundStyle(Brand.inkMuted)
                    if profile.userRole != .admin {
                        Button("Tornar admin") { Task { await setRole(profile, "admin") } }
                    }
                    if profile.userRole != .cliente {
                        Button("Tornar cliente") { Task { await setRole(profile, "cliente") } }
                    }
                }
            }
            .navigationTitle("Clientes")
            .searchable(text: $query)
            .onSubmit(of: .search) { Task { await load() } }
            .refreshable { await load() }
            .task { await load() }
            .safeAreaInset(edge: .bottom) {
                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.white)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(Brand.danger)
                }
            }
        }
    }

    private func load() async {
        do {
            rows = try await Repository.clients(search: query)
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }

    private func setRole(_ profile: Profile, _ role: String) async {
        do {
            try await Repository.setRole(userId: profile.id, role: role)
            await load()
        } catch {
            self.error = describeError(error)
        }
    }
}

private struct AdminProducts: View {
    @State private var rows: [Product] = []
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List(rows) { product in
                HStack {
                    VStack(alignment: .leading) {
                        Text(product.name).font(.headline)
                        Text(Money.format(cents: product.listPriceCents))
                            .font(.caption)
                            .foregroundStyle(Brand.inkMuted)
                    }
                    Spacer()
                    Toggle("Ativo", isOn: binding(product))
                        .labelsHidden()
                }
            }
            .navigationTitle("Produtos")
            .refreshable { await load() }
            .task { await load() }
            .safeAreaInset(edge: .bottom) {
                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.white)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(Brand.danger)
                }
            }
        }
    }

    private func binding(_ product: Product) -> Binding<Bool> {
        Binding(
            get: { rows.first { $0.id == product.id }?.active ?? product.active },
            set: { newValue in
                Task { await toggle(product, newValue) }
            }
        )
    }

    private func load() async {
        do {
            rows = try await Repository.allProducts()
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }

    private func toggle(_ product: Product, _ active: Bool) async {
        do {
            try await Repository.setProductActive(id: product.id, active: active)
            await load()
        } catch {
            self.error = describeError(error)
        }
    }
}

private struct AdminNotices: View {
    @Environment(SessionStore.self) private var session
    @State private var notices: [Notice] = []
    @State private var kind = "recado"
    @State private var title = ""
    @State private var bodyText = ""
    @State private var coupon = ""
    @State private var error: String?

    private let kinds = ["pendencia", "recado", "sorteio", "ganhador", "cupom"]

    var body: some View {
        NavigationStack {
            Form {
                Picker("Tipo", selection: $kind) {
                    ForEach(kinds, id: \.self) { Text($0).tag($0) }
                }
                TextField("Título", text: $title)
                TextField("Mensagem", text: $bodyText, axis: .vertical)
                TextField("Cupom (opcional)", text: $coupon)
                Button("Publicar") { Task { await publish() } }
                if let error { Text(error).foregroundStyle(Brand.danger) }
                Section("Publicados") {
                    ForEach(notices) { notice in
                        VStack(alignment: .leading) {
                            Text(notice.title).font(.headline)
                            Text(notice.body).font(.caption)
                        }
                    }
                }
            }
            .navigationTitle("Avisos")
            .task { await load() }
        }
    }

    private func load() async {
        do {
            notices = try await Repository.notices()
        } catch {
            self.error = describeError(error)
        }
    }

    private func publish() async {
        guard let author = session.profile?.id else { return }
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBody = bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty, !trimmedBody.isEmpty else {
            error = "Informe título e mensagem."
            return
        }
        do {
            try await Repository.publishNotice(
                kind: kind,
                title: trimmedTitle,
                body: trimmedBody,
                coupon: coupon.trimmingCharacters(in: .whitespacesAndNewlines),
                author: author
            )
            title = ""
            bodyText = ""
            coupon = ""
            error = nil
            await load()
        } catch {
            self.error = describeError(error)
        }
    }
}
