import SwiftUI

struct WalletView: View {
    @Environment(SessionStore.self) private var session
    @State private var contributions: [Contribution] = []
    @State private var ledger: [WalletEntry] = []
    @State private var withdrawals: [WithdrawalRequest] = []
    @State private var error: String?
    @State private var loading = true

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
                            Text("Bônus \(Money.format(cents: session.profile?.bonusCents ?? 0))")
                                .foregroundStyle(Brand.accent)
                        }
                    }
                    if let error { Text(error).foregroundStyle(Brand.danger) }
                    if loading { ProgressView() }
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
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }
}
