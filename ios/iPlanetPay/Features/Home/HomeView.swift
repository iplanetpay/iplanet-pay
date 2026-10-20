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
                            message: "Escolha um aparelho no catálogo e gere o aporte Pix na reserva."
                        )
                        Button("Ver catálogo") { router.selectedTab = .catalog }
                            .buttonStyle(PrimaryButtonStyle())
                    } else {
                        ForEach(active) { reservation in
                            Button {
                                router.reservationID = reservation.id
                            } label: {
                                reservationCard(reservation)
                            }
                            .buttonStyle(.plain)
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

    private func reservationCard(_ reservation: ReservationRow) -> some View {
        BrandCard {
            VStack(alignment: .leading, spacing: 10) {
                RemoteImage(url: AppConfig.media(reservation.product?.imageUrl))
                Text(reservation.product?.name ?? "Reserva")
                    .font(.title3.weight(.bold))
                Text(reservation.product?.subtitle ?? "")
                    .foregroundStyle(Brand.inkMuted)
                ProgressTrack(value: reservation.progress)
                Text("\(Money.format(cents: reservation.remainingCents)) restantes")
                    .font(.subheadline.weight(.semibold))
            }
        }
    }

    private var shortcutGrid: some View {
        VStack(spacing: 12) {
            shortcut("Catálogo", "Veja modelos disponíveis para nova reserva.", tab: .catalog)
            shortcut("Carteira", "Aportes Pix confirmados e extrato.", tab: .wallet)
            shortcut("Metas", "Simule aportes e acompanhe a meta.", tab: .goals)
            shortcut("Conta", "Indicações, ranking, avisos e perfil.", tab: .account)
        }
    }

    private func shortcut(_ title: String, _ message: String, tab: AppTab) -> some View {
        Button {
            router.selectedTab = tab
        } label: {
            BrandCard {
                VStack(alignment: .leading, spacing: 6) {
                    Text(title).font(.title3.weight(.bold))
                    Text(message).foregroundStyle(Brand.inkMuted)
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
