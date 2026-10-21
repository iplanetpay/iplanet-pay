import SwiftUI

struct HomeView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router
    @State private var reservations: [ReservationRow] = []
    @State private var error: String?
    @State private var loading = true
    @State private var showSimulator = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Olá, \(session.profile?.displayName ?? "Cliente")")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Brand.inkMuted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .padding(.top, -14)
                        .contentTransition(.opacity)
                        .modifier(StaggerIn(delay: 0))
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Sua reserva")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Brand.accent)
                        Text("Continue no seu ritmo")
                            .font(.title2.weight(.bold))
                        Text("Acompanhe o aporte, pague com Pix e explore o catálogo.")
                            .foregroundStyle(Brand.inkMuted)
                    }
                    .modifier(StaggerIn(delay: 0.06))
                    if let error {
                        Text(error).foregroundStyle(Brand.danger)
                    }
                    if loading {
                        LoadingSkeleton(.reservationCard)
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
                        .modifier(StaggerIn(delay: 0.12))
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
            .fullScreenCover(isPresented: $showSimulator) {
                SimulatorSheet(products: []) { reservationId in
                    showSimulator = false
                    if let reservationId {
                        router.reservationID = reservationId
                    }
                    Task { await load() }
                }
            }
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
            shortcut("Simulador", "Simulador de aportes", "Calcule o valor de cada aporte e crie a meta do produto.", "Abrir simulador", tab: nil, openSimulator: true)
        }
    }

    private func shortcut(
        _ pill: String,
        _ title: String,
        _ message: String,
        _ action: String,
        tab: AppTab?,
        overlay: AppOverlay? = nil,
        openSimulator: Bool = false
    ) -> some View {
        Button {
            if openSimulator { showSimulator = true }
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
    @State private var forward = true
    @State private var dragX: CGFloat = 0
    @Namespace private var dots
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
                            .contentTransition(.numericText())
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
                .id(item.id)
                .transition(cardTransition)
                .offset(x: dragX)
                .rotation3DEffect(.degrees(Double(dragX) / -25), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
                .gesture(
                    DragGesture(minimumDistance: 20)
                        .onChanged { value in
                            guard count > 1, abs(value.translation.width) > abs(value.translation.height) else { return }
                            dragX = value.translation.width * 0.6
                        }
                        .onEnded { value in
                            guard count > 1 else { return }
                            if value.translation.width < -60 { go(1) } else if value.translation.width > 60 { go(-1) }
                            withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) { dragX = 0 }
                        }
                )
                .accessibilityElement(children: .contain)
            }
            if count > 1 {
                HStack(spacing: 12) {
                    Button {
                        go(-1)
                    } label: {
                        Image(systemName: "chevron.left")
                            .frame(width: 44, height: 44)
                            .background(Brand.background)
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("Reserva anterior")
                    HStack(spacing: 8) {
                        ForEach(items.indices, id: \.self) { position in
                            ZStack {
                                Capsule().fill(Brand.line).frame(width: 8, height: 8)
                                if position == safe {
                                    Capsule().fill(Brand.accent)
                                        .frame(width: 22, height: 8)
                                        .matchedGeometryEffect(id: "dot", in: dots)
                                }
                            }
                            .frame(width: position == safe ? 22 : 8, height: 8)
                                .accessibilityLabel("Reserva \(position + 1) de \(count)")
                        }
                    }
                    Button {
                        go(1)
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
            go(1)
        }
    }

    private var cardTransition: AnyTransition {
        if reduceMotion { return .opacity }
        let edgeIn: Edge = forward ? .trailing : .leading
        let edgeOut: Edge = forward ? .leading : .trailing
        return .asymmetric(
            insertion: .move(edge: edgeIn).combined(with: .opacity).combined(with: .scale(scale: 0.94)),
            removal: .move(edge: edgeOut).combined(with: .opacity).combined(with: .scale(scale: 0.94))
        )
    }

    private func go(_ delta: Int) {
        forward = delta > 0
        Haptics.tap()
        let animation: Animation? = reduceMotion ? .easeInOut(duration: 0.2) : .spring(response: 0.55, dampingFraction: 0.82)
        withAnimation(animation) { index = step(min(index, items.count - 1), delta, items.count) }
    }

    private func step(_ current: Int, _ delta: Int, _ count: Int) -> Int {
        guard count > 0 else { return 0 }
        let next = current + delta
        if next < 0 { return count - 1 }
        if next >= count { return 0 }
        return next
    }
}

/// Entrada suave (sobe + aparece) ao abrir a tela; respeita "Reduzir movimento".
struct StaggerIn: ViewModifier {
    var delay: Double
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .opacity(shown || reduceMotion ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 18)
            .onAppear {
                guard !shown else { return }
                withAnimation(.spring(response: 0.6, dampingFraction: 0.85).delay(delay)) { shown = true }
            }
    }
}
