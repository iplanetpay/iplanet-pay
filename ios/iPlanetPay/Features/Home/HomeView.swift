import SwiftUI

struct HomeView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router
    @State private var reservations: [ReservationRow] = []
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Sua reserva")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Brand.accent)
                        Text("Continue no seu ritmo")
                            .font(.largeTitle.weight(.bold))
                        Text("Acompanhe o aporte, pague com Pix e explore o catálogo.")
                            .foregroundStyle(Brand.inkMuted)
                    }
                    if let error {
                        Text(error).foregroundStyle(Brand.danger)
                    }
                    if loading {
                        ProgressView()
                    } else if active.isEmpty {
                        EmptyPane(
                            title: "Nenhuma reserva ativa",
                            message: "Escolha um iPhone no catálogo e gere o aporte Pix na reserva."
                        )
                        Button("Ver catálogo") { router.selectedTab = .catalog }
                            .buttonStyle(PrimaryButtonStyle(fill: Brand.accent))
                    } else {
                        ActiveReservationCarousel(items: active) { id in
                            router.reservationID = id
                        }
                    }
                    if (session.profile?.bonusCents ?? 0) > 0 {
                        BrandCard {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Bônus de indicação")
                                    .font(.headline)
                                Text(Money.format(cents: session.profile?.bonusCents ?? 0))
                                    .font(.title2.weight(.bold))
                                    .foregroundStyle(Brand.accent)
                                Text("Abra uma reserva ativa para aplicar o bônus.")
                                    .font(.subheadline)
                                    .foregroundStyle(Brand.inkMuted)
                            }
                        }
                    }
                    shortcutGrid
                }
                .padding(20)
            }
            .background(Brand.backgroundSubtle)
            .navigationTitle("Início")
            .navigationDestination(item: reservationBinding) { id in
                ReservationDetailView(reservationID: id)
            }
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private var reservationBinding: Binding<UUID?> {
        Binding(get: { router.reservationID }, set: { router.reservationID = $0 })
    }

    private var active: [ReservationRow] {
        reservations.filter { $0.status == "ativa" }
    }

    private var shortcutGrid: some View {
        VStack(spacing: 12) {
            shortcut("Atalho", "Catálogo", "Veja modelos disponíveis para nova reserva.", "Abrir catálogo", tab: .catalog)
            shortcut("Ranking", "Fichas & posição", "Acompanhe o ranking de aportes e suas fichas para o sorteio.", "Ver ranking →", tab: nil, overlay: .ranking)
            shortcut("Carteira", "Saldo & Pix", "Veja aportes Pix confirmados e o extrato da carteira.", "Ir para carteira →", tab: .wallet)
            shortcut("Simulador", "Simulador de aportes", "Calcule o valor de cada aporte e crie a meta do produto.", "Abrir simulador", tab: .goals)
        }
    }

    private func shortcut(
        _ pill: String,
        _ title: String,
        _ message: String,
        _ action: String,
        tab: AppTab?,
        overlay: AppOverlay? = nil
    ) -> some View {
        Button {
            if let overlay { router.overlay = overlay }
            if let tab { router.selectedTab = tab }
        } label: {
            BrandCard {
                VStack(alignment: .leading, spacing: 6) {
                    StatusPill(text: pill, tone: .lavender)
                    Text(title).font(.title3.weight(.bold))
                    Text(message).foregroundStyle(Brand.inkMuted)
                    Text(action)
                        .font(.subheadline.weight(.semibold))
                        .padding(.top, 4)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private func load() async {
        guard let userId = session.profile?.id else { return }
        loading = reservations.isEmpty
        defer { loading = false }
        do {
            reservations = try await Repository.myReservations(userId: userId)
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }
}

private struct ActiveReservationCarousel: View {
    let items: [ReservationRow]
    var open: (UUID) -> Void
    @State private var index = 0

    var body: some View {
        let count = items.count
        let safe = count == 0 ? 0 : min(index, count - 1)
        VStack(spacing: 12) {
            if count > 0 {
                let item = items[safe]
                BrandCard {
                    VStack(alignment: .leading, spacing: 12) {
                        StatusPill(text: "Reserva ativa", tone: .accent)
                        Text(item.product?.name ?? "Reserva")
                            .font(.title2.weight(.bold))
                        Text(item.product?.subtitle ?? "")
                            .foregroundStyle(Brand.inkMuted)
                        Text("\(Money.format(cents: item.remainingCents)) restantes")
                            .font(.subheadline.weight(.semibold))
                        RemoteImage(url: AppConfig.media(item.product?.imageUrl))
                        HStack(alignment: .center) {
                            ProgressRing(percent: item.progress * 100, caption: "quitado", size: 96)
                            Spacer()
                            VStack(spacing: 8) {
                                Button("Ver reserva") { open(item.id) }
                                    .buttonStyle(PrimaryButtonStyle())
                                Button("Gerar aporte Pix") { open(item.id) }
                                    .buttonStyle(PrimaryButtonStyle(fill: Brand.accent))
                            }
                        }
                    }
                }
                .accessibilityElement(children: .contain)
            }
            if count > 1 {
                HStack(spacing: 12) {
                    Button {
                        index = step(safe, -1, count)
                    } label: {
                        Image(systemName: "chevron.left")
                            .frame(width: 44, height: 44)
                            .background(Brand.background)
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("Reserva anterior")
                    HStack(spacing: 8) {
                        ForEach(items.indices, id: \.self) { position in
                            Circle()
                                .fill(position == safe ? Brand.accent : Brand.line)
                                .frame(width: position == safe ? 10 : 8, height: 8)
                                .accessibilityLabel("Reserva \(position + 1) de \(count)")
                        }
                    }
                    Button {
                        index = step(safe, 1, count)
                    } label: {
                        Image(systemName: "chevron.right")
                            .foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(Brand.ink)
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("Próxima reserva")
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Reservas ativas")
        .task(id: index) {
            guard count > 1 else { return }
            try? await Task.sleep(for: .seconds(10))
            guard !Task.isCancelled else { return }
            index = step(index, 1, count)
        }
    }

    private func step(_ current: Int, _ delta: Int, _ count: Int) -> Int {
        guard count > 0 else { return 0 }
        let next = current + delta
        if next < 0 { return count - 1 }
        if next >= count { return 0 }
        return next
    }
}
