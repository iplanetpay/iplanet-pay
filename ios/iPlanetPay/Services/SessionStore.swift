import Foundation
import Supabase

@MainActor
@Observable
final class SessionStore {
    enum Phase: Equatable {
        case loading
        case signedOut
        case signedIn
    }

    private(set) var phase: Phase = .loading
    private(set) var profile: Profile?
    private(set) var email: String = ""
    private(set) var signedInWithGoogle = false
    private(set) var profileError: String?
    var needsPasswordUpdate = false
    var prefersClientShell = false
    private var started = false

    var userId: UUID? { profile?.id }
    var role: UserRole { profile?.userRole ?? .cliente }
    var isAdmin: Bool { role == .admin }

    init() {
        Task { await observe() }
    }

    func observe() async {
        guard !started else { return }
        started = true
        for await (event, session) in SupabaseService.client.auth.authStateChanges {
            await apply(event: event, session: session)
        }
    }

    func refreshProfile() async {
        guard let id = profile?.id ?? currentSessionUserId else { return }
        await loadProfile(userId: id, fallbackName: profile?.fullName ?? "")
    }

    func signOut() async {
        do {
            try await SupabaseService.client.auth.signOut()
        } catch {
            profileError = describeError(error)
        }
        profile = nil
        email = ""
        signedInWithGoogle = false
        needsPasswordUpdate = false
        prefersClientShell = false
        phase = .signedOut
    }

    private var currentSessionUserId: UUID? {
        profile?.id
    }

    private func apply(event: AuthChangeEvent, session: Session?) async {
        switch event {
        case .initialSession, .signedIn, .tokenRefreshed, .userUpdated, .mfaChallengeVerified:
            guard let session else {
                profile = nil
                phase = .signedOut
                return
            }
            email = session.user.email ?? ""
            signedInWithGoogle = Self.usesGoogle(session.user)
            let name = Self.metadataName(session.user)
            await loadProfile(userId: session.user.id, fallbackName: name)
            await syncAvatarIfNeeded(user: session.user)
        case .passwordRecovery:
            needsPasswordUpdate = true
            if let session {
                email = session.user.email ?? ""
                await loadProfile(userId: session.user.id, fallbackName: Self.metadataName(session.user))
            }
        case .signedOut, .userDeleted:
            profile = nil
            email = ""
            signedInWithGoogle = false
            needsPasswordUpdate = false
            phase = .signedOut
        @unknown default:
            break
        }
    }

    private func loadProfile(userId: UUID, fallbackName: String) async {
        do {
            let loaded = try await Repository.ensureProfile(id: userId, fullName: fallbackName)
            profile = loaded
            profileError = nil
            phase = .signedIn
        } catch {
            profileError = describeError(error)
            phase = .signedIn
        }
    }

    private func syncAvatarIfNeeded(user: User) async {
        guard profile?.avatarUrl == nil else { return }
        let picture = jsonText(user.userMetadata["avatar_url"])
            ?? jsonText(user.userMetadata["picture"])
        guard let picture, !picture.isEmpty, let id = profile?.id else { return }
        do {
            try await Repository.updateProfile(id: id, fields: ["avatar_url": picture])
            if var current = profile {
                current.avatarUrl = picture
                profile = current
            }
        } catch {
            profileError = nil
        }
    }

    private static func usesGoogle(_ user: User) -> Bool {
        if jsonText(user.appMetadata["provider"]) == "google" { return true }
        return (user.identities ?? []).contains { $0.provider == "google" }
    }

    private static func metadataName(_ user: User) -> String {
        jsonText(user.userMetadata["full_name"])
            ?? jsonText(user.userMetadata["name"])
            ?? ""
    }
}

private func jsonText(_ value: AnyJSON?) -> String? {
    guard let value else { return nil }
    if case .string(let text) = value { return text }
    return nil
}

@MainActor
@Observable
final class AppRouter {
    var reservationID: UUID?
    var selectedTab: AppTab = .home
    var authMessage: String?

    func open(_ url: URL) {
        guard let scheme = url.scheme?.lowercased() else { return }
        if scheme == "iplanetpay" {
            let host = url.host?.lowercased() ?? ""
            if host == "auth-callback" || host == "login-callback" {
                SupabaseService.client.handle(url)
                return
            }
            if host == "reserva" {
                let raw = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                if let id = UUID(uuidString: raw) {
                    reservationID = id
                    selectedTab = .home
                }
                return
            }
            if host == "catalogo" {
                selectedTab = .catalog
                return
            }
        }
        SupabaseService.client.handle(url)
    }
}

enum AppTab: Hashable {
    case home
    case catalog
    case wallet
    case goals
    case account
}
