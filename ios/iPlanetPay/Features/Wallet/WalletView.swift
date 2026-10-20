import SwiftUI

struct WalletView: View {
    @Environment(SessionStore.self) private var session
    @State private var contributions: [Contribution] = []
    @State private var ledger: [WalletEntry] = []
    @State private var withdrawals: [WithdrawalRequest] = []
    @State private var error: String?
    @State private var loading = true
    @State private var showApply = false
    @State private var showWithdraw = false
    @State private var reservations: [ReservationRow] = []

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Saldo e Pix")
                        .font(.largeTitle.weight(.bold))
                    Text("Aportes confirmados, extrato e pedidos de saque.")
                        .foregroundStyle(Brand.inkMuted)
                    BrandCard {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Confirmado").font(.subheadline).foregroundStyle(Brand.inkMuted)
                            Text(Money.format(cents: confirmed))
                                .font(.title.weight(.bold))
                                .contentTransition(.numericText())
                            Text("Bônus \(Money.format(cents: session.profile?.bonusCents ?? 0))")
                                .foregroundStyle(Brand.accent)
                            Text("Mínimo R$ 1.000,00 para saque. Ao solicitar, 30% fica com a plataforma e 70% segue para o Pix.")
                                .font(.footnote)
                                .foregroundStyle(Brand.inkMuted)
                            Button("Usar saldo em uma reserva") { showApply = true }
                                .buttonStyle(SecondaryButtonStyle())
                            Button("Sacar saldo") { showWithdraw = true }
                                .buttonStyle(SecondaryButtonStyle())
                        }
                    }
                    if let error { Text(error).foregroundStyle(Brand.danger) }
                    if loading { LoadingSkeleton(lines: 3) }
                    Text("Aportes").font(.title3.weight(.bold))
                    if contributions.isEmpty {
                        Text("Nenhum aporte ainda.").foregroundStyle(Brand.inkMuted)
                    }
                    ForEach(contributions) { item in
                        BrandCard {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(Money.format(cents: item.amountCents)).font(.headline)
                                    Text(item.statusLabel).font(.caption).foregroundStyle(Brand.inkMuted)
                                }
                                Spacer()
                                if let date = item.createdAt {
                                    Text(DatesPT.medium(date)).font(.caption)
                                }
                            }
                        }
                    }
                    Text("Extrato").font(.title3.weight(.bold))
                    ForEach(ledger) { entry in
                        BrandCard {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(entry.label).font(.headline)
                                    if let memo = entry.memo, !memo.isEmpty {
                                        Text(memo).font(.caption).foregroundStyle(Brand.inkMuted)
                                    }
                                }
                                Spacer()
                                Text(Money.format(cents: entry.amountCents))
                            }
                        }
                    }
                    Text("Saques").font(.title3.weight(.bold))
                    if withdrawals.isEmpty {
                        Text("Nenhum saque pedido.").foregroundStyle(Brand.inkMuted)
                    }
                    ForEach(withdrawals) { item in
                        BrandCard {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.statusLabel).font(.headline)
                                Text("Reembolso \(Money.format(cents: item.refundAmountCents))")
                                Text("Taxa \(Money.format(cents: item.feeAmountCents))")
                                    .font(.caption)
                                    .foregroundStyle(Brand.inkMuted)
                            }
                        }
                    }
                }
                .padding(20)
            }
            .background(Brand.backgroundSubtle)
            .navigationTitle("Carteira")
            .refreshable { await load() }
            .task { await load() }
            .sheet(isPresented: $showApply) {
                WalletApplySheet(reservations: reservations.filter { $0.status == "ativa" }) {
                    showApply = false
                    Task { await load() }
                }
            }
            .sheet(isPresented: $showWithdraw) {
                WalletWithdrawSheet {
                    showWithdraw = false
                    Task { await load() }
                }
            }
        }
    }

    private var confirmed: Int {
        contributions.filter { $0.status == "confirmed" }.reduce(0) { $0 + $1.amountCents }
    }

    private func load() async {
        guard let userId = session.profile?.id else { return }
        loading = contributions.isEmpty
        defer { loading = false }
        do {
            contributions = try await Repository.myContributions(userId: userId)
            ledger = try await Repository.ledger(userId: userId)
            withdrawals = try await Repository.withdrawals(userId: userId)
            reservations = try await Repository.myReservations(userId: userId)
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }
}

private struct WalletApplySheet: View {
    let reservations: [ReservationRow]
    var onDone: () -> Void
    @State private var reservationId: UUID?
    @State private var amount = ""
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Picker("Reserva", selection: $reservationId) {
                    Text("Escolha").tag(Optional<UUID>.none)
                    ForEach(reservations) { item in
                        Text(item.product?.name ?? "Reserva").tag(Optional(item.id))
                    }
                }
                TextField("Valor (R$)", text: $amount)
                    .keyboardType(.decimalPad)
                if let message { Text(message).foregroundStyle(Brand.danger) }
                Button(busy ? "Aplicando…" : "Aplicar na reserva") { Task { await apply() } }
                    .disabled(busy || reservationId == nil)
            }
            .navigationTitle("Usar saldo")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Fechar") { onDone() } }
            }
        }
    }

    private func apply() async {
        guard let reservationId, let cents = Money.cents(from: amount), cents > 0 else {
            message = "Informe a reserva e o valor."
            return
        }
        busy = true
        defer { busy = false }
        do {
            try await WebAPI.applyWallet(reservationId: reservationId, amountCents: cents)
            onDone()
        } catch {
            message = describeError(error)
        }
    }
}

private struct WalletWithdrawSheet: View {
    var onDone: () -> Void
    @Environment(SessionStore.self) private var session
    @State private var amount = ""
    @State private var pixKey = ""
    @State private var pixType = "cpf"
    @State private var holder = ""
    @State private var cpf = ""
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Text("Mínimo R$ 1.000,00. Ao solicitar, 30% fica com a plataforma e 70% segue para o Pix.")
                    .font(.footnote)
                TextField("Valor (R$)", text: $amount).keyboardType(.decimalPad)
                TextField("Titular", text: $holder)
                TextField("CPF do titular", text: $cpf)
                Picker("Tipo da chave", selection: $pixType) {
                    Text("CPF").tag("cpf")
                    Text("CNPJ").tag("cnpj")
                    Text("E-mail").tag("email")
                    Text("Telefone").tag("phone")
                    Text("Aleatória").tag("random")
                }
                TextField("Chave Pix", text: $pixKey)
                if let message { Text(message).foregroundStyle(Brand.danger) }
                Button(busy ? "Enviando…" : "Solicitar saque") { Task { await submit() } }
                    .disabled(busy)
            }
            .navigationTitle("Sacar saldo")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Fechar") { onDone() } }
            }
            .onAppear {
                holder = session.profile?.fullName ?? ""
                cpf = session.profile?.cpf ?? ""
                pixKey = session.profile?.pixKey ?? ""
                pixType = session.profile?.pixKeyType ?? "cpf"
            }
        }
    }

    private func submit() async {
        guard let cents = Money.cents(from: amount) else {
            message = "Informe o valor."
            return
        }
        busy = true
        defer { busy = false }
        do {
            try await WebAPI.withdrawWallet(
                WebAPI.WalletWithdrawBody(
                    amountCents: cents,
                    pixKey: pixKey.trimmingCharacters(in: .whitespacesAndNewlines),
                    pixKeyType: pixType,
                    holderFullName: holder.trimmingCharacters(in: .whitespacesAndNewlines),
                    holderCpf: BrazilID.normalizeCPF(cpf) ?? cpf
                )
            )
            onDone()
        } catch {
            message = describeError(error)
        }
    }
}
