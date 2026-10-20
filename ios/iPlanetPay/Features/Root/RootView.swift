import SwiftUI

struct RootView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router

    var body: some View {
        Group {
            switch session.phase {
            case .loading:
                splash
            case .signedOut:
                AuthView()
            case .signedIn:
                if session.profile == nil {
                    profileFailure
                } else if session.needsIdentityOnboarding {
                    NavigationStack {
                        ProfileView(onboarding: true)
                    }
                } else {
                    ClientShell()
                }
            }
        }
        .preferredColorScheme(.light)
        .background(Brand.backgroundSubtle)
        .sheet(isPresented: passwordBinding) {
            PasswordUpdateView()
        }
    }

    private var passwordBinding: Binding<Bool> {
        Binding(
            get: { session.needsPasswordUpdate },
            set: { session.needsPasswordUpdate = $0 }
        )
    }

    private var splash: some View {
        VStack(spacing: 16) {
            Wordmark(height: 36)
            ProgressView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Brand.background)
    }

    private var profileFailure: some View {
        VStack(spacing: 16) {
            Text("Não foi possível carregar seu perfil.")
                .font(.title3.weight(.semibold))
                .multilineTextAlignment(.center)
            if let profileError = session.profileError {
                Text(profileError)
                    .font(.body)
                    .foregroundStyle(Brand.inkMuted)
                    .multilineTextAlignment(.center)
            }
            Button("Tentar de novo") {
                Task { await session.refreshProfile() }
            }
            .buttonStyle(PrimaryButtonStyle())
            Button("Sair") {
                Task { await session.signOut() }
            }
            .buttonStyle(SecondaryButtonStyle())
        }
        .padding(24)
    }
}

struct ClientShell: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.selectedTab) {
            HomeView()
                .tabItem { Label("Início", systemImage: "house") }
                .tag(AppTab.home)
            CatalogView()
                .tabItem { Label("Catálogo", systemImage: "square.grid.2x2") }
                .tag(AppTab.catalog)
            WalletView()
                .tabItem { Label("Carteira", systemImage: "wallet.pass") }
                .tag(AppTab.wallet)
            GoalsView()
                .tabItem { Label("Metas", systemImage: "flag") }
                .tag(AppTab.goals)
            ReferralsView()
                .tabItem { Label("Indicações", systemImage: "person.2") }
                .tag(AppTab.referrals)
            AccountView()
                .tabItem { Label("Conta", systemImage: "person.crop.circle") }
                .tag(AppTab.account)
        }
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarBackground(.ultraThinMaterial, for: .tabBar)
        .safeAreaInset(edge: .top, spacing: 0) {
            ClientHeader()
        }
        .overlay(alignment: .bottom) {
            FirstRunGuideOverlay()
        }
        .sheet(item: overlayBinding) { overlay in
            NavigationStack {
                switch overlay {
                case .ranking:
                    RankingView()
                case .notices:
                    NoticesView()
                case .settings:
                    ProfileView()
                case .terms:
                    TermsView()
                case .admin:
                    AdminLinkView()
                case .support:
                    SupportChatView()
                        .toolbar(.hidden, for: .navigationBar)
                }
            }
        }
    }

    private var overlayBinding: Binding<AppOverlay?> {
        Binding(get: { router.overlay }, set: { router.overlay = $0 })
    }
}

struct PasswordUpdateView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                SecureField("Nova senha", text: $password)
                if let message {
                    Text(message).foregroundStyle(Brand.danger)
                }
                Button(busy ? "Salvando…" : "Salvar senha") {
                    Task { await save() }
                }
                .disabled(busy || password.count < 8)
            }
            .navigationTitle("Nova senha")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { dismiss() }
                }
            }
        }
    }

    private func save() async {
        busy = true
        defer { busy = false }
        do {
            try await WebAPI.updatePassword(password)
            session.needsPasswordUpdate = false
            dismiss()
        } catch {
            message = describeError(error)
        }
    }
}
