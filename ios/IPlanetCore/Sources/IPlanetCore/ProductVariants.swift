import Foundation

/// Uma combinação Cor × Armazenamento que leva a um produto reservável (linha de `products`).
public struct VariantOption: Equatable, Sendable {
    public var productId: UUID
    public var color: String
    public var storage: String
    public var priceCents: Int
    public var imageUrl: String?

    public init(productId: UUID, color: String, storage: String, priceCents: Int, imageUrl: String?) {
        self.productId = productId
        self.color = color
        self.storage = storage
        self.priceCents = priceCents
        self.imageUrl = imageUrl
    }
}

/// Matriz de variantes de um modelo, como no site: cada produto ativo tem cor/armazenamento próprios
/// e `product_variants` (ativas) acrescentam cores ao produto, mantendo o preço e o produto da reserva.
public struct VariantMatrix: Equatable, Sendable {
    public private(set) var options: [VariantOption] = []
    public private(set) var colors: [String] = []
    public private(set) var storages: [String] = []

    public init(options input: [VariantOption]) {
        for option in input {
            let color = option.color.trimmingCharacters(in: .whitespacesAndNewlines)
            let storage = option.storage.trimmingCharacters(in: .whitespacesAndNewlines)
            var clean = option
            clean.color = color
            clean.storage = storage
            if options.contains(where: { $0.color.lowercased() == color.lowercased() && $0.storage.lowercased() == storage.lowercased() }) { continue }
            options.append(clean)
            if !color.isEmpty, !colors.contains(where: { $0.lowercased() == color.lowercased() }) { colors.append(color) }
            if !storage.isEmpty, !storages.contains(where: { $0.lowercased() == storage.lowercased() }) { storages.append(storage) }
        }
        storages.sort { VariantMatrix.capacityGB($0) < VariantMatrix.capacityGB($1) }
    }

    public func resolve(color: String?, storage: String?) -> VariantOption? {
        options.first { match($0.color, color) && match($0.storage, storage) }
    }

    public func isAvailable(color: String?, storage: String?) -> Bool {
        resolve(color: color, storage: storage) != nil
    }

    /// Ao trocar uma dimensão, mantém a outra se a combinação existir; senão escolhe a primeira disponível.
    public func select(color: String?, storage: String?, changed: Dimension) -> VariantOption? {
        if let exact = resolve(color: color, storage: storage) { return exact }
        switch changed {
        case .color: return options.first { match($0.color, color) } ?? options.first
        case .storage: return options.first { match($0.storage, storage) } ?? options.first
        }
    }

    public enum Dimension: Sendable { case color, storage }

    private func match(_ value: String, _ wanted: String?) -> Bool {
        guard let wanted, !wanted.isEmpty else { return true }
        return value.lowercased() == wanted.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// "128GB" → 128, "1TB" → 1024; sem número vai para o fim.
    public static func capacityGB(_ text: String) -> Double {
        let lower = text.lowercased().replacingOccurrences(of: ",", with: ".")
        let digits = lower.prefix { $0.isNumber || $0 == "." || $0 == " " }.trimmingCharacters(in: .whitespaces)
        guard let value = Double(digits) else { return .greatestFiniteMagnitude }
        return lower.contains("tb") ? value * 1024 : value
    }
}

/// Mesma tabela de cores do site (catalog-product-card.tsx → colorHex).
public enum ColorSwatch {
    private static let table: [([String], String)] = [
        (["preto", "black", "meia-noite", "midnight", "space", "grafite"], "#1d1d1f"),
        (["branco", "white", "starlight", "estelar", "prateado", "prata", "silver"], "#f2f2f4"),
        (["azul", "blue", "ultramar"], "#3d7ea6"),
        (["verde", "green", "teal"], "#3d8c6e"),
        (["amarelo", "yellow"], "#f5d76e"),
        (["rosa", "pink"], "#f0b7c4"),
        (["roxo", "purple", "lavanda"], "#b7a6d8"),
        (["dourado", "gold", "deserto", "desert"], "#d6b98c"),
        (["natural", "titânio", "titanio", "titanium"], "#8d8d92"),
        (["vermelho", "red", "product"], "#c43b3b"),
        (["laranja", "orange"], "#e07a3d"),
    ]

    public static func hex(_ name: String) -> String {
        let lower = name.lowercased()
        for (keys, hex) in table where keys.contains(where: { lower.contains($0) }) { return hex }
        return "#c7c7cc"
    }
}
