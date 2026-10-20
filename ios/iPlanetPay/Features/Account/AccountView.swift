import SwiftUI
import UIKit

struct AccountView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(session.profile?.displayName ?? "Conta")
                            .font(.title3.weight(.bold))
                        Text(session.email)
                            .font(.subheadline)
                            .foregroundStyle(Brand.inkMuted)
                        if session.profile?.identityComplete != true {
                            Text("Cadastro incompleto")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Brand.danger)
                        }
                    }
                    .padding(.vertical, 4)
                }
                Section("Você") {
                    NavigationLink("Perfil e cadastro", destination: ProfileView())
                    NavigationLink("Indicações", destination: ReferralsView())
                    NavigationLink("Ranking e fichas", destination: RankingView())
                    NavigationLink("Avisos", destination: NoticesView())
                }
                Section("Ajuda") {
                    NavigationLink("Perguntas frequentes", destination: HelpView())
                    NavigationLink("Termos de uso", destination: TermsView())
                    Link("Abrir o site", destination: AppConfig.webAppURL)
                }
                Section {
                    Button("Sair", role: .destructive) {
                        Task { await session.signOut() }
                    }
                }
            }
            .navigationTitle("Conta")
            .scrollContentBackground(.hidden)
            .background(Brand.backgroundSubtle)
        }
    }
}

struct ProfileView: View {
    var onboarding = false
    @Environment(SessionStore.self) private var session
    @State private var fullName = ""
    @State private var phone = ""
    @State private var cpf = ""
    @State private var city = ""
    @State private var state = "SP"
    @State private var address = ""
    @State private var number = ""
    @State private var birth = Date(timeIntervalSince1970: 631_152_000)
    @State private var pixKey = ""
    @State private var pixType = "cpf"
    @State private var message: String?
    @State private var busy = false

    private let pixTypes = ["cpf", "cnpj", "email", "phone", "random"]

    var body: some View {
        Form {
            if onboarding {
                Section {
                    Text("O aporte só fica liberado depois de CPF, telefone, cidade, endereço e data de nascimento. Os termos de uso estão na versão platform-v2.")
                        .font(.footnote)
                        .foregroundStyle(Brand.inkMuted)
                    NavigationLink("Ler termos de uso", destination: TermsView())
                }
            }
            Section("Conta") {
                TextField("Nome", text: $fullName)
                TextField("Telefone", text: $phone)
                TextField("CPF", text: $cpf)
                TextField("Cidade", text: $city)
                Picker("UF", selection: $state) {
                    ForEach(BrazilID.states, id: \.self) { Text($0).tag($0) }
                }
                TextField("Endereço", text: $address)
                TextField("Número", text: $number)
                DatePicker("Nascimento", selection: $birth, displayedComponents: .date)
            }
            if !onboarding {
                Section("Pix") {
                    Picker("Tipo", selection: $pixType) {
                        ForEach(pixTypes, id: \.self) { Text($0).tag($0) }
                    }
                    TextField("Chave", text: $pixKey)
                }
            }
            if let message {
                Text(message).foregroundStyle(message == "Salvo." ? Brand.success : Brand.danger)
            }
            Button(busy ? "Salvando…" : "Salvar") {
                Task { await save() }
            }
            .disabled(busy)
            if onboarding {
                Button("Sair", role: .destructive) {
                    Task { await session.signOut() }
                }
            }
        }
        .navigationTitle(onboarding ? "Complete seu cadastro" : "Perfil")
        .onAppear(perform: fill)
    }

    private func fill() {
        guard let profile = session.profile else { return }
        fullName = profile.fullName
        phone = profile.phone ?? ""
        cpf = profile.cpf ?? ""
        city = profile.city ?? ""
        state = profile.state ?? "SP"
        address = profile.address ?? ""
        number = profile.addressNumber ?? ""
        if let date = DatesPT.parseDay(profile.birthDate) { birth = date }
        pixKey = profile.pixKey ?? ""
        pixType = profile.pixKeyType ?? "cpf"
    }

    private func save() async {
        guard let id = session.profile?.id else { return }
        let birthDay = DatesPT.isoDay(birth)
        if let missing = identityMessage(
            cpf: cpf,
            phone: BrazilPhone.normalize(phone),
            city: city,
            state: state,
            address: address,
            number: number,
            birth: birthDay
        ) {
            message = missing
            return
        }
        busy = true
        defer { busy = false }
        do {
            try await Repository.updateProfile(
                id: id,
                fields: [
                    "full_name": fullName.trimmingCharacters(in: .whitespacesAndNewlines),
                    "phone": BrazilPhone.normalize(phone),
                    "cpf": BrazilID.normalizeCPF(cpf),
                    "city": city.trimmingCharacters(in: .whitespacesAndNewlines),
                    "state": state,
                    "address": address.trimmingCharacters(in: .whitespacesAndNewlines),
                    "address_number": number.trimmingCharacters(in: .whitespacesAndNewlines),
                    "birth_date": birthDay,
                    "pix_key": pixKey.trimmingCharacters(in: .whitespacesAndNewlines),
                    "pix_key_type": pixType,
                ]
            )
            await session.refreshProfile()
            message = "Salvo."
        } catch {
            message = describeError(error)
        }
    }
}

struct ReferralsView: View {
    @Environment(SessionStore.self) private var session
    @State private var code = ""
    @State private var rows: [ReferralRow] = []
    @State private var names: [UUID: String] = [:]
    @State private var message: String?

    var body: some View {
        List {
            Section("Seu código") {
                Text(session.profile?.referralCode ?? "—")
                    .font(.title2.weight(.bold))
                    .textSelection(.enabled)
                Button("Copiar") {
                    UIPasteboard.general.string = session.profile?.referralCode
                }
            }
            if session.profile?.referredBy == nil {
                Section("Usar um código") {
                    TextField("Código", text: $code)
                        .textInputAutocapitalization(.characters)
                    Button("Aplicar") { Task { await apply() } }
                }
            }
            if let message { Text(message) }
            Section("Indicados") {
                if rows.isEmpty {
                    Text("Nenhuma indicação ainda.")
                }
                ForEach(rows) { row in
                    VStack(alignment: .leading) {
                        Text(names[row.referredId] ?? "Cliente")
                        Text("\(row.statusLabel) · \(Money.format(cents: row.bonusAmountCents))")
                            .font(.caption)
                            .foregroundStyle(Brand.inkMuted)
                    }
                }
            }
        }
        .navigationTitle("Indicações")
        .task { await load() }
    }

    private func load() async {
        guard let userId = session.profile?.id else { return }
        do {
            rows = try await Repository.referrals(userId: userId)
            let people = try await Repository.profiles(ids: rows.map(\.referredId))
            names = Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0.displayName) })
        } catch {
            message = describeError(error)
        }
    }

    private func apply() async {
        do {
            try await Repository.applyReferral(code: code)
            await session.refreshProfile()
            message = "Código aplicado."
            await load()
        } catch {
            message = describeError(error)
        }
    }
}

struct RankingView: View {
    @Environment(SessionStore.self) private var session
    @State private var balance = RaffleMath.Balance(contributedCents: 0, eligibleCents: 0, tickets: 0, eligible: false)
    @State private var draws: [RaffleDraw] = []
    @State private var error: String?

    var body: some View {
        List {
            Section {
                Text(LegalCopy.raffleEligibility)
                    .font(.footnote)
                Text("Próximo sorteio em \(DatesPT.daysUntilNextRaffle()) dias (todo dia 1).")
            }
            Section("Suas fichas") {
                LabeledContent("Fichas", value: "\(balance.tickets)")
                LabeledContent("Elegível", value: Money.format(cents: balance.eligibleCents))
                LabeledContent("Aportado", value: Money.format(cents: balance.contributedCents))
                if !balance.eligible {
                    Text("Ainda fora do sorteio até 30% de uma reserva.")
                        .font(.caption)
                        .foregroundStyle(Brand.inkMuted)
                }
            }
            Section("Sorteios") {
                if draws.isEmpty {
                    Text("Nenhum sorteio publicado.")
                }
                ForEach(draws) { draw in
                    VStack(alignment: .leading) {
                        Text(draw.winnerName ?? "Sorteio")
                            .font(.headline)
                        Text("\(draw.winnerTickets ?? 0) fichas · \(draw.drawMonth ?? "")")
                            .font(.caption)
                            .foregroundStyle(Brand.inkMuted)
                    }
                }
            }
            Section {
                Text("O ranking dos outros clientes fica no site. A leitura dos aportes de terceiros exige o servidor; aqui entram só os seus aportes e os sorteios públicos.")
                    .font(.footnote)
                    .foregroundStyle(Brand.inkMuted)
            }
            if let error { Text(error).foregroundStyle(Brand.danger) }
        }
        .navigationTitle("Ranking")
        .task { await load() }
    }

    private func load() async {
        guard let userId = session.profile?.id else { return }
        do {
            let reservations = try await Repository.myReservations(userId: userId)
            let contributions = try await Repository.myContributions(userId: userId)
            balance = RaffleMath.balance(contributions: contributions, reservations: reservations)
            draws = try await Repository.raffleDraws()
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }
}

struct NoticesView: View {
    @Environment(SessionStore.self) private var session
    @State private var notices: [Notice] = []
    @State private var reads: Set<UUID> = []
    @State private var error: String?

    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(Brand.danger) }
            ForEach(notices) { notice in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        StatusPill(text: notice.kindLabel, tone: .lavender)
                        if !reads.contains(notice.id) {
                            StatusPill(text: "Novo", tone: .accent)
                        }
                    }
                    Text(notice.title).font(.headline)
                    Text(notice.body)
                    if let coupon = notice.couponCode {
                        Text(coupon)
                            .font(.body.monospaced().weight(.bold))
                            .textSelection(.enabled)
                    }
                }
                .padding(.vertical, 4)
                .onAppear {
                    Task { await mark(notice) }
                }
            }
        }
        .navigationTitle("Avisos")
        .task { await load() }
    }

    private func load() async {
        guard let userId = session.profile?.id else { return }
        do {
            notices = try await Repository.notices()
            reads = try await Repository.noticeReads(userId: userId)
        } catch {
            self.error = describeError(error)
        }
    }

    private func mark(_ notice: Notice) async {
        guard let userId = session.profile?.id, !reads.contains(notice.id) else { return }
        do {
            try await Repository.markNoticeRead(noticeId: notice.id, userId: userId)
            reads.insert(notice.id)
        } catch {
            reads.insert(notice.id)
        }
    }
}

struct HelpView: View {
    private let items: [(String, String)] = [
        ("Pix e aporte", "Você reserva o aparelho e faz aportes via Pix no seu ritmo até quitar. Quando o saldo atingir o valor, retire na loja."),
        ("Lojas", "Temos unidades em Itaim Bibi (São Paulo) e São Caetano do Sul. Escolha a loja na reserva."),
        ("Reserva", "Escolha o produto no catálogo, entre na conta e confirme a loja de retirada. A reserva fica ativa enquanto você aporte."),
        ("Retirada", "Após quitar a reserva, vá até a loja escolhida. A equipe confirma a retirada no painel."),
        ("Cancelar", "Você pode cancelar uma reserva ativa pelo app. Em caso de aportes já confirmados, fale com o suporte."),
    ]

    var body: some View {
        List {
            ForEach(items, id: \.0) { item in
                VStack(alignment: .leading, spacing: 6) {
                    Text(item.0).font(.headline)
                    Text(item.1).foregroundStyle(Brand.inkMuted)
                }
                .padding(.vertical, 4)
            }
            Section {
                Link("Falar no site", destination: AppConfig.web("/ajuda"))
            }
        }
        .navigationTitle("Ajuda")
    }
}

struct TermsView: View {
    var body: some View {
        ScrollView {
            Text(LegalCopy.terms)
                .font(.body)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
        }
        .background(Brand.background)
        .navigationTitle("Termos")
    }
}
