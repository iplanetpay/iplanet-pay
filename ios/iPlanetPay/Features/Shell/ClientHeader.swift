import SwiftUI

struct ClientHeader: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router
    @Environment(\.openURL) private var openURL
    @State private var tickets = 0
    @State private var unread = 0

    var body: some View {
        HStack(spacing: 8) {
            Wordmark(height: 22)
                .accessibilityHidden(true)
            Spacer(minLength: 8)
            Button {
                router.overlay = .settings
            } label: {
                avatar
            }
            .frame(minWidth: 44, minHeight: 44)
            .accessibilityLabel("Foto do perfil")
            Button {
                router.overlay = .ranking
            } label: {
                Text(tickets == 1 ? "1 ficha" : "\(tickets) fichas")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Brand.accent)
            }
            .frame(minHeight: 44)
            .accessibilityLabel("Fichas e ranking")
            Button {
                router.overlay = .notices
            } label: {
                Image(systemName: unread > 0 ? "bell.badge" : "bell")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Brand.ink)
            }
            .frame(minWidth: 44, minHeight: 44)
            .accessibilityLabel(unread > 0 ? "Avisos, \(unread) não lidos" : "Avisos")
            Menu {
                Button("Configurações") { router.overlay = .settings }
                Button("Sair", role: .destructive) {
                    Task { await session.signOut() }
                }
                Button("Suporte") { router.overlay = .support }
                Divider()
                Button("Guia · Termos de uso") { openURL(AppConfig.web("/termos")) }
                if session.isAdmin {
                    Button("Admin") { router.overlay = .admin }
                }
            } label: {
                Image(systemName: "line.3.horizontal")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Brand.ink)
                    .frame(minWidth: 44, minHeight: 44)
            }
            .accessibilityLabel("Menu")
        }
        .padding(.horizontal, 12)
        .background(Brand.background)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Brand.line).frame(height: 1)
        }
        .task { await refresh() }
    }

    @ViewBuilder
    private var avatar: some View {
        if let url = AppConfig.media(session.profile?.avatarUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    avatarFallback
                }
            }
            .frame(width: 32, height: 32)
            .clipShape(Circle())
        } else {
            avatarFallback
        }
    }

    private var avatarFallback: some View {
        Image(systemName: "person.crop.circle.fill")
            .font(.title2)
            .foregroundStyle(Brand.inkMuted)
    }

    private func refresh() async {
        guard let userId = session.profile?.id else { return }
        do {
            async let reservations = Repository.myReservations(userId: userId)
            async let contributions = Repository.myContributions(userId: userId)
            async let notices = Repository.notices()
            async let reads = Repository.noticeReads(userId: userId)
            let balance = RaffleMath.balance(
                contributions: try await contributions,
                reservations: try await reservations
            )
            tickets = balance.tickets
            let readIds = try await reads
            unread = try await notices.filter { !readIds.contains($0.id) }.count
        } catch {
            tickets = 0
        }
    }
}

struct AdminLinkView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("O admin fica no site.")
                .font(.title3.weight(.semibold))
            Text("Abra a página Admin no navegador. As telas de administração não ficam neste app.")
                .foregroundStyle(Brand.inkMuted)
            Link("Abrir Admin", destination: AppConfig.web("/admin"))
                .buttonStyle(PrimaryButtonStyle())
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Brand.backgroundSubtle)
        .navigationTitle("Admin")
        .navigationBarTitleDisplayMode(.inline)
    }
}
