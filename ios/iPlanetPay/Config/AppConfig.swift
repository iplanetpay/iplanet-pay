import Foundation

enum AppConfig {
    static let authRedirectURL = URL(string: "iplanetpay://auth-callback")!
    static let bundleID = "com.iplanetpay.app"

    static let supabaseURL: URL = {
        url(info("SUPABASE_URL"), fallback: "https://xeeogfmmasvgbpmodqym.supabase.co")
    }()

    static let supabaseAnonKey: String = {
        let value = info("SUPABASE_ANON_KEY") ?? ""
        if value.isEmpty || value.contains("$(") {
            return "sb_publishable_LfK2s9fW5x1JDOQZ05khBg_BjT2wDhq"
        }
        return value
    }()

    /// Real iOS OAuth client (`….apps.googleusercontent.com`). Placeholders keep the OAuth web fallback.
    static var googleIOSClientID: String? {
        configuredGoogleID(info("GOOGLE_IOS_CLIENT_ID"), suffix: ".apps.googleusercontent.com")
    }

    static var googleReversedClientID: String? {
        configuredGoogleID(info("GOOGLE_IOS_REVERSED_CLIENT_ID"), prefix: "com.googleusercontent.apps.")
    }

    static var usesNativeGoogle: Bool {
        googleIOSClientID != nil && googleReversedClientID != nil
    }

    static let webAppURL: URL = {
        url(info("WEB_APP_URL"), fallback: "https://iplanet-pay.vercel.app")
    }()

    static func web(_ path: String) -> URL {
        let base = webAppURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let suffix = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: base + suffix) ?? webAppURL
    }

    static func media(_ raw: String?) -> URL? {
        guard let raw else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let url = URL(string: trimmed), url.scheme != nil {
            return url
        }
        return web(trimmed)
    }

    private static func configuredGoogleID(_ raw: String?, suffix: String? = nil, prefix: String? = nil) -> String? {
        guard let raw else { return nil }
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, !value.contains("placeholder"), !value.contains("$(") else { return nil }
        if let suffix, !value.hasSuffix(suffix) { return nil }
        if let prefix, !value.hasPrefix(prefix) { return nil }
        return value
    }

    private static func info(_ key: String) -> String? {
        let value = Bundle.main.object(forInfoDictionaryKey: key) as? String
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed?.isEmpty == false, trimmed?.contains("$(") == false {
            return trimmed
        }
        return nil
    }

    private static func url(_ raw: String?, fallback: String) -> URL {
        let candidate = raw?.isEmpty == false ? raw! : fallback
        guard let url = URL(string: candidate) else {
            preconditionFailure("URL inválida: \(candidate)")
        }
        return url
    }
}
