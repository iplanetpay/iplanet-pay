import Foundation
import Supabase

enum AppCoding {
    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = parseDate(string) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid date format: \(string)"
            )
        }
        return decoder
    }()

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(formatDate(date))
        }
        return encoder
    }()

    static func parseDate(_ string: String) -> Date? {
        if let date = try? Date(string, strategy: iso(fractional: true)) {
            return date
        }
        if let date = try? Date(string, strategy: iso(fractional: false)) {
            return date
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        let formats = [
            "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSSSSSZ",
            "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
            "yyyy-MM-dd'T'HH:mm:ssZ",
        ]
        for format in formats {
            formatter.dateFormat = format
            if let date = formatter.date(from: string) {
                return date
            }
        }
        return nil
    }

    static func formatDate(_ date: Date) -> String {
        date.formatted(iso(fractional: true))
    }

    private static func iso(fractional: Bool) -> Date.ISO8601FormatStyle {
        Date.ISO8601FormatStyle(includingFractionalSeconds: fractional)
    }
}

enum SupabaseService {
    static let client: SupabaseClient = {
        SupabaseClient(
            supabaseURL: AppConfig.supabaseURL,
            supabaseKey: AppConfig.supabaseAnonKey,
            options: SupabaseClientOptions(
                db: .init(encoder: AppCoding.encoder, decoder: AppCoding.decoder),
                auth: .init(
                    redirectToURL: AppConfig.authRedirectURL,
                    flowType: .pkce,
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }()
}

enum RPC {
    struct CreateReservation: Encodable, Sendable {
        let pProductId: UUID
        let pStoreId: UUID
    }

    struct ReservationID: Encodable, Sendable {
        let pReservationId: UUID
    }

    struct SwitchReservation: Encodable, Sendable {
        let pOldReservationId: UUID
        let pNewProductId: UUID
    }

    struct CreateContribution: Encodable, Sendable {
        let pReservationId: UUID
        let pAmountCents: Int
    }

    struct ContributionID: Encodable, Sendable {
        let pContributionId: UUID
    }

    struct ReferralCode: Encodable, Sendable {
        let pCode: String
    }

    struct Withdrawal: Encodable, Sendable {
        let pReservationId: UUID
        let pPixKey: String
        let pPixKeyType: String
        let pHolderFullName: String
        let pHolderCpf: String
    }

    struct RoleChange: Encodable, Sendable {
        let pUserId: UUID
        let pRole: String
    }

    struct TradeIn: Encodable, Sendable {
        let pReservationId: UUID
        let pDevices: [Device]

        struct Device: Encodable, Sendable {
            let id: UUID
            let deviceModel: String
            let imei: String
            let expectedValueCents: Int
            let minimumValueCents: Int
            let maintenanceOptions: [String]
            let liquidExposure: Bool
            let photoPaths: [String]
            let batteryHealthPct: Int?
            let batteryHealthReason: String?
        }
    }
}
