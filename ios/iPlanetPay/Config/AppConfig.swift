import Foundation

enum AppConfig {
    static let authRedirectURL = URL(string: "iplanetpay://auth-callback")!
    static let bundleID = "com.iplanetpay.app"

    static let supabaseURL: URL = {
        url(info("SUPABASE_URL"), fallback: "https://zjnikfrledckmjahwnsb.supabase.co")
    }()

    static let supabaseAnonKey: String = {
        let value = info("SUPABASE_ANON_KEY") ?? ""
        if value.isEmpty {
            return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbmlrZnJsZWRja21qYWh3bnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjg5MjAsImV4cCI6MjEwNTc0NDkyMH0.6teIFzZMLo0CNl9fqmO5KcdHfac05yAx9hF5rVvIfAw"
        }
        return value
    }()

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
