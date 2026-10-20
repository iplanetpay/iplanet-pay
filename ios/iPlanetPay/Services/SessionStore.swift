import Foundation
import GoogleSignIn
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
    private(set) var signedInWithApple = false
    private(set) var profileError: String?
    var pendingProviderName = ""
    var needsPasswordUpdate = false
    var prefersClientShell = false
    private var started = false

    var userId: UUID? { profile?.id }
    var role: UserRole { profile?.userRole ?? .cliente }
    var isAdmin: Bool { role == .admin }
    var signedInWithSocial: Bool { signedInWithGoogle || signedInWithApple }
    var needsIdentityOnboarding: Bool {
        guard let profile, role == .cliente else { return false }
        return !profile.identityComplete
    }

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
        guard let user = SupabaseService.client.auth.currentUser else { return }
        let fallback = profile?.fullName ?? Self.metadataName(user)
        await loadProfile(userId: user.id, fallbackName: fallback, accountEmail: user.email ?? email)
    }

    func signOut() async {
        do {
            try? await WebAPI.logout()
            try await SupabaseService.client.auth.signOut()
        } catch {
            profileError = describeError(error)
        }
        GIDSignIn.sharedInstance.signOut()
        profile = nil
        email = ""
        signedInWithGoogle = false
        signedInWithApple = false
        pendingProviderName = ""
        needsPasswordUpdate = false
        prefersClientShell = false
        phase = .signedOut
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
            signedInWithGoogle = Self.usesProvider(session.user, "google")
            signedInWithApple = Self.usesProvider(session.user, "apple")
            let metadataName = Self.metadataName(session.user)
            let name = metadataName.isEmpty ? pendingProviderName : metadataName
            await loadProfile(
                userId: session.user.id,
                fallbackName: name,
                accountEmail: session.user.email ?? ""
            )
            await syncAvatarIfNeeded(user: session.user)
        case .passwordRecovery:
            needsPasswordUpdate = true
            if let session {
                email = session.user.email ?? ""
                signedInWithGoogle = Self.usesProvider(session.user, "google")
                signedInWithApple = Self.usesProvider(session.user, "apple")
                await loadProfile(
                    userId: session.user.id,
                    fallbackName: Self.metadataName(session.user),
                    accountEmail: session.user.email ?? ""
                )
            }
        case .signedOut, .userDeleted:
            profile = nil
            email = ""
            signedInWithGoogle = false
            signedInWithApple = false
            pendingProviderName = ""
            needsPasswordUpdate = false
            phase = .signedOut
        @unknown default:
            break
        }
    }

    private func loadProfile(userId: UUID, fallbackName: String, accountEmail: String) async {
        do {
            var loaded = try await Repository.ensureProfile(id: userId, fullName: fallbackName)
            let stored = loaded.fullName.trimmingCharacters(in: .whitespacesAndNewlines)
            let incoming = fallbackName.trimmingCharacters(in: .whitespacesAndNewlines)
            if stored.isEmpty, !incoming.isEmpty {
                try await Repository.updateProfile(id: userId, fields: ["full_name": incoming])
                try? await SupabaseService.client.auth.update(
                    user: UserAttributes(data: ["full_name": .string(incoming)])
                )
                loaded.fullName = incoming
                pendingProviderName = ""
            }
            loaded = try await applyPendingEmailSignup(userId: userId, accountEmail: accountEmail, profile: loaded)
            profile = loaded
            profileError = nil
            phase = .signedIn
        } catch {
            profileError = describeError(error)
            phase = .signedIn
        }
    }

    /// Writes the signup form after the confirmation link creates a session.
    private func applyPendingEmailSignup(userId: UUID, accountEmail: String, profile: Profile) async throws -> Profile {
        guard let pending = PendingEmailSignupStore.load() else { return profile }
        guard pending.email.caseInsensitiveCompare(accountEmail) == .orderedSame else { return profile }
        var current = profile
        let needsIdentity = !current.identityComplete
        let needsTerms = current.termsAcceptedAt == nil
        if needsIdentity || needsTerms {
            var fields: [String: String?] = [:]
            if needsIdentity {
                fields["full_name"] = pending.fullName
                fields["phone"] = pending.phone
                fields["cpf"] = pending.cpf
                fields["city"] = pending.city
                fields["state"] = pending.state
                fields["address"] = pending.address
                fields["address_number"] = pending.addressNumber
                fields["birth_date"] = pending.birthDate
            }
            if needsTerms {
                fields["terms_version"] = pending.termsVersion
                fields["terms_accepted_at"] = pending.termsAcceptedAt
            }
            try await Repository.updateProfile(id: userId, fields: fields)
            if let refreshed = try await Repository.profile(id: userId) {
                current = refreshed
            }
        }
        let code = pending.referralCode.trimmingCharacters(in: .whitespacesAndNewlines)
        if !code.isEmpty, current.referredBy == nil {
            try? await Repository.applyReferral(code: code)
            if let refreshed = try await Repository.profile(id: userId) {
                current = refreshed
            }
        }
        PendingEmailSignupStore.clear()
        return current
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

    private static func usesProvider(_ user: User, _ provider: String) -> Bool {
        if jsonText(user.appMetadata["provider"]) == provider { return true }
        return (user.identities ?? []).contains { $0.provider == provider }
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
    var goalID: UUID?
    var selectedTab: AppTab = .home
    var authMessage: String?
    var overlay: AppOverlay?

    func open(_ url: URL) {
        guard let scheme = url.scheme?.lowercased() else { return }
        if GIDSignIn.sharedInstance.handle(url) {
            return
        }
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
    case referrals
    case account
}

enum AppOverlay: String, Identifiable {
    case ranking
    case notices
    case settings
    case terms
    case admin

    var id: String { rawValue }
}
