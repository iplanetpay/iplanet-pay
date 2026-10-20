import Foundation

/// Identity collected on the signup form. Confirm-email is on, so there is no
/// session until the user opens the link, and these fields cannot be written yet.
struct PendingEmailSignup: Codable, Sendable {
    var email: String
    var fullName: String
    var phone: String
    var cpf: String
    var city: String
    var state: String
    var address: String
    var addressNumber: String
    var birthDate: String
    var referralCode: String
    var termsAcceptedAt: String
    var termsVersion: String

    var profileFields: [String: String?] {
        [
            "full_name": fullName,
            "phone": phone,
            "cpf": cpf,
            "city": city,
            "state": state,
            "address": address,
            "address_number": addressNumber,
            "birth_date": birthDate,
            "terms_version": termsVersion,
            "terms_accepted_at": termsAcceptedAt,
        ]
    }
}

@MainActor
enum PendingEmailSignupStore {
    private static let key = "iplanet.pendingEmailSignup"

    static func save(_ value: PendingEmailSignup) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func load() -> PendingEmailSignup? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(PendingEmailSignup.self, from: data)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
