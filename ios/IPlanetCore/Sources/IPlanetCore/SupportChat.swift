import Foundation

/// Evento do stream SSE de `POST /api/support/chat`.
public enum SupportEvent: Equatable, Sendable {
    case delta(String)
    case done
    case error(String)
}

public enum SupportSSE {
    /// Lê uma linha `data: {json}`. Linhas vazias, comentários e tipos desconhecidos viram `nil`.
    public static func parse(line raw: String) -> SupportEvent? {
        let line = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard line.hasPrefix("data:") else { return nil }
        let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
        guard let data = payload.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = object["type"] as? String else { return nil }
        switch type {
        case "delta": return .delta(object["text"] as? String ?? "")
        case "done": return .done
        case "error": return .error(object["error"] as? String ?? "Não foi possível responder agora.")
        default: return nil
        }
    }
}

public struct SupportMessage: Equatable, Sendable, Codable {
    public var role: String
    public var content: String
    public init(role: String, content: String) {
        self.role = role
        self.content = content
    }
}

public enum SupportHistory {
    public static let maxMessages = 20
    public static let maxChars = 2000

    /// Só `user`/`assistant`, sem vazias, cada uma com até 2.000 caracteres, as 20 últimas.
    public static func prepare(_ messages: [SupportMessage]) -> [SupportMessage] {
        let clean = messages
            .filter { ($0.role == "user" || $0.role == "assistant") && !$0.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .map { SupportMessage(role: $0.role, content: String($0.content.prefix(maxChars))) }
        return Array(clean.suffix(maxMessages))
    }

    /// "5511999999999" → URL do wa.me.
    public static func whatsappURL(_ digits: String?) -> URL? {
        let only = (digits ?? "").filter(\.isNumber)
        guard !only.isEmpty else { return nil }
        return URL(string: "https://wa.me/\(only)")
    }
}
