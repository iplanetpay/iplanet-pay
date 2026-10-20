import IPlanetCore
import SwiftUI

/// Guia passo a passo do primeiro acesso: catálogo → reserva → meta (opcional) → Pix → aporte confirmado.
/// O estado vem dos dados reais (retomável) e as preferências ficam no UserDefaults por usuário.
struct FirstRunGuideOverlay: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var facts: GuideFacts?
    @State private var visible = false
    @State private var collapsed = false
    @State private var celebrating = false
    @State private var pulse = false

    var body: some View {
        Group {
            if visible, let facts {
                let step = celebrating ? .done : FirstRunGuide.step(facts)
                card(step: step)
                    .padding(.horizontal, 14)
                    .padding(.bottom, 58)
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                    .id(collapsed)
            }
        }
        .animation(reduceMotion ? nil : .spring(response: 0.5, dampingFraction: 0.85), value: visible)
        .animation(reduceMotion ? nil : .spring(response: 0.5, dampingFraction: 0.85), value: facts)
        .animation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.85), value: collapsed)
        .task(id: session.profile?.id) { await loop() }
        .onChange(of: router.guideViewedProduct) { _, viewed in
            if viewed, let userId { defaults.set(true, forKey: key(userId, "viewedProduct")); facts?.viewedProduct = true }
        }
        .onChange(of: router.selectedTab) { _, _ in Task { await refresh() } }
    }

    // MARK: Card

    @ViewBuilder
    private func card(step: GuideStep) -> some View {
        if collapsed {
            Button {
                collapsed = false
            } label: {
                Label("Guia · passo \(min(step.number, 5)) de 5", systemImage: "sparkles")
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Brand.ink, in: Capsule())
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.2), radius: 12, y: 6)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
            .accessibilityHint("Abre o guia do primeiro aporte")
        } else {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 6) {
                    ForEach(GuideStep.visible, id: \.self) { s in
                        Capsule()
                            .fill(s < step ? Brand.success : (s == step ? Brand.accent : Color.white.opacity(0.18)))
                            .frame(height: 4)
                            .scaleEffect(x: 1, y: s == step && pulse && !reduceMotion ? 1.6 : 1)
                    }
                }
                HStack(alignment: .top, spacing: 12) {
                    ZStack {
                        Circle().fill(Brand.accent.opacity(0.2)).frame(width: 40, height: 40)
                            .scaleEffect(pulse && !reduceMotion ? 1.15 : 1)
                        Image(systemName: icon(step)).font(.headline).foregroundStyle(Brand.accent)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(step == .done ? "Concluído" : "Passo \(step.number) de 5")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.6))
                        Text(step.title).font(.headline).foregroundStyle(.white)
                        Text(step.message).font(.subheadline).foregroundStyle(.white.opacity(0.8))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .id(step)
                    .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))
                    Spacer(minLength: 0)
                    Button { collapsed = true } label: {
                        Image(systemName: "chevron.down").font(.footnote.weight(.bold)).foregroundStyle(.white.opacity(0.6))
                            .frame(width: 32, height: 32)
                    }
                    .accessibilityLabel("Minimizar guia")
                }
                HStack(spacing: 10) {
                    if step == .done {
                        Button("Concluir") { finish() }
                            .buttonStyle(PrimaryButtonStyle(fill: Brand.accent))
                    } else {
                        if let action = actionTitle(step) {
                            Button(action) { perform(step) }
                                .buttonStyle(PrimaryButtonStyle(fill: Brand.accent))
                        }
                        if step == .createGoal {
                            Button("Pular etapa") { skipGoal() }
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white)
                        }
                    }
                }
                if step != .done {
                    Button("Sair do guia") { dismiss() }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.55))
                }
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(LinearGradient(colors: [Color(red: 0.07, green: 0.09, blue: 0.2), Color(red: 0.1, green: 0.12, blue: 0.32)], startPoint: .topLeading, endPoint: .bottomTrailing))
            )
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(.white.opacity(0.12)))
            .shadow(color: Brand.accent.opacity(0.25), radius: 24, y: 10)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) { pulse = true }
            }
            .sensoryFeedback(.success, trigger: step == .done)
            .accessibilityElement(children: .contain)
        }
    }

    private func icon(_ step: GuideStep) -> String {
        switch step {
        case .chooseProduct: "iphone"
        case .createReservation: "bookmark.fill"
        case .createGoal: "target"
        case .generatePix: "qrcode"
        case .confirmPayment: "checkmark.seal"
        case .done: "party.popper.fill"
        }
    }

    private func actionTitle(_ step: GuideStep) -> String? {
        switch step {
        case .chooseProduct, .createReservation: router.selectedTab == .catalog ? nil : "Abrir catálogo"
        case .createGoal: "Abrir reserva"
        case .generatePix: "Gerar Pix"
        case .confirmPayment: "Ver reserva"
        case .done: nil
        }
    }

    private func perform(_ step: GuideStep) {
        Haptics.tap()
        switch step {
        case .chooseProduct, .createReservation:
            router.selectedTab = .catalog
        case .createGoal, .confirmPayment:
            openReservation(requestPix: false)
        case .generatePix:
            openReservation(requestPix: true)
        case .done:
            break
        }
    }

    private func openReservation(requestPix: Bool) {
        Task {
            guard let userId = session.profile?.id,
                  let first = try? await Repository.myReservations(userId: userId).first(where: { $0.status == "ativa" }) else {
                router.selectedTab = .catalog
                return
            }
            if requestPix { router.requestPixReservationID = first.id }
            router.selectedTab = .home
            router.reservationID = first.id
        }
    }

    // MARK: Estado

    private var defaults: UserDefaults { .standard }
    private var userId: String? { session.profile?.id.uuidString }
    private func key(_ user: String, _ name: String) -> String { FirstRunGuide.defaultsKey(userId: user, name) }

    private func loop() async {
        guard let userId, !defaults.bool(forKey: key(userId, "dismissed")), !defaults.bool(forKey: key(userId, "completed")) else {
            visible = false
            return
        }
        await refresh(firstLaunch: true)
        while !Task.isCancelled && visible {
            try? await Task.sleep(for: .seconds(6))
            await refresh()
        }
    }

    private func refresh(firstLaunch: Bool = false) async {
        guard let profileId = session.profile?.id, let userId else { return }
        let dismissed = defaults.bool(forKey: key(userId, "dismissed"))
        let completed = defaults.bool(forKey: key(userId, "completed"))
        guard !dismissed, !completed else { visible = false; return }
        do {
            async let reservations = Repository.myReservations(userId: profileId)
            async let contributions = Repository.myContributions(userId: profileId)
            async let goals = Repository.goals(userId: profileId)
            let (r, c, g) = try await (reservations, contributions, goals)
            let confirmed = c.contains { $0.status == "confirmed" }
            let next = GuideFacts(
                hasReservation: r.contains { $0.status == "ativa" },
                hasGoal: !g.isEmpty,
                goalSkipped: defaults.bool(forKey: key(userId, "goalSkipped")),
                hasPendingPix: c.contains { $0.status == "pending" },
                hasConfirmedContribution: confirmed,
                viewedProduct: defaults.bool(forKey: key(userId, "viewedProduct")) || router.guideViewedProduct
            )
            if facts == nil {
                // Primeiro acesso = nenhum aporte confirmado ainda. Quem já aportou não vê o guia.
                guard FirstRunGuide.shouldShow(facts: next, dismissed: false, completed: false) else {
                    defaults.set(true, forKey: key(userId, "completed"))
                    visible = false
                    return
                }
                if firstLaunch, !defaults.bool(forKey: key(userId, "started")), !next.hasReservation {
                    defaults.set(true, forKey: key(userId, "started"))
                    router.selectedTab = .catalog
                }
            } else if confirmed, !celebrating {
                celebrating = true
                Haptics.tap()
            }
            facts = next
            visible = true
        } catch {
            // Mantém o último estado; tenta de novo no próximo ciclo.
            if facts != nil { visible = true }
        }
    }

    private func skipGoal() {
        guard let userId else { return }
        defaults.set(true, forKey: key(userId, "goalSkipped"))
        facts?.goalSkipped = true
    }

    private func dismiss() {
        guard let userId else { return }
        defaults.set(true, forKey: key(userId, "dismissed"))
        visible = false
    }

    private func finish() {
        guard let userId else { return }
        defaults.set(true, forKey: key(userId, "completed"))
        visible = false
    }
}
