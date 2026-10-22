import Foundation

/// Uma combinação Cor × Armazenamento que leva a um produto reservável (linha de `products`).
public struct VariantOption: Equatable, Sendable {
    public var productId: UUID
    /// Id em `product_variants`; `nil` = o próprio produto.
    public var variantId: UUID?
    public var color: String
    public var storage: String
    public var priceCents: Int
    public var imageUrl: String?
    /// "#RRGGBB" gravado no banco (pode faltar antes da migração 035).
    public var colorHex: String?

    public init(productId: UUID, variantId: UUID? = nil, color: String, colorHex: String? = nil, storage: String, priceCents: Int, imageUrl: String?) {
        self.colorHex = colorHex
        self.productId = productId
        self.variantId = variantId
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
    private var storedHex: [String: String] = [:]

    /// Hex da cor: o primeiro gravado entre as opções dessa cor, senão pelo nome.
    public func hex(for color: String) -> String {
        ColorSwatch.hex(color, stored: storedHex[color.lowercased()])
    }

    public init(options input: [VariantOption]) {
        for option in input where option.priceCents > 0 {
            let color = option.color.trimmingCharacters(in: .whitespacesAndNewlines)
            let storage = option.storage.trimmingCharacters(in: .whitespacesAndNewlines)
            var clean = option
            clean.color = color
            clean.storage = storage
            if options.contains(where: { $0.color.lowercased() == color.lowercased() && $0.storage.lowercased() == storage.lowercased() }) { continue }
            if let hex = ColorSwatch.normalize(option.colorHex), storedHex[color.lowercased()] == nil {
                storedHex[color.lowercased()] = hex
            }
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
        case .color:
            // Mantém o armazenamento se existir na cor; senão o menor disponível (como no site).
            return options.filter { match($0.color, color) }
                .min { VariantMatrix.capacityGB($0.storage) < VariantMatrix.capacityGB($1.storage) } ?? options.first
        case .storage: return options.first { match($0.storage, storage) } ?? options.first
        }
    }

    /// "256 GB · Preto", igual a `variantLabel` do site.
    public static func label(_ option: VariantOption) -> String {
        [option.storage, option.color].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    /// A função create_reservation grava "Variante: 256 GB · Preto" nas notas da reserva.
    public static func label(fromNotes notes: String?) -> String? {
        guard let notes else { return nil }
        for line in notes.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("Variante:") {
                let value = trimmed.dropFirst("Variante:".count).trimmingCharacters(in: .whitespaces)
                return value.isEmpty ? nil : value
            }
        }
        return nil
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

/// Família do seletor de cor/armazenamento: só o próprio produto (linhas com o mesmo nome),
/// igual ao site. Agrupar pelo `model` misturava versões diferentes do mesmo aparelho
/// (ex.: "iPhone 17 Pro Max (eSIM)" e "(Anatel Chip)" têm 256 GB Laranja com preços diferentes)
/// e a combinação repetida escondia uma delas com o preço errado.
public enum ProductFamily {
    public static func members<T>(of product: T, in all: [T], name: (T) -> String) -> [T] {
        let key = name(product).trimmingCharacters(in: .whitespaces).lowercased()
        let same = all.filter { name($0).trimmingCharacters(in: .whitespaces).lowercased() == key }
        return same.isEmpty ? [product] : same
    }
}

/// Porte de src/lib/catalog/colors.ts: hex gravado > hex pelo nome > cinza neutro.
public enum ColorSwatch {
    public static let fallbackHex = "#C7C7CC"

    /// Regras por nome, da mais específica para a mais genérica (mesma ordem do site).
    private static let rules: [(String, String)] = [
        (#"tit[aâ]nio\s*natural|natural"#, "#BAB4A9"),
        (#"tit[aâ]nio\s*preto|black\s*titanium"#, "#3C3C3D"),
        (#"tit[aâ]nio\s*branco|white\s*titanium"#, "#F2F1ED"),
        (#"tit[aâ]nio\s*deserto|deserto|desert"#, "#BFA48F"),
        (#"azul[\s-]*sierra|sierra"#, "#9BB5CE"),
        (#"meia[\s-]*noite|midnight"#, "#232A31"),
        (#"cinza[\s-]*espacial|space\s*gr[ae]y"#, "#535150"),
        (#"grafite|graphite"#, "#41424C"),
        (#"estelar|starlight"#, "#F0E8DC"),
        (#"lavanda|lavender"#, "#C9B8E8"),
        (#"bord[oô]|burgundy"#, "#6B2A35"),
        (#"product|vermelho|red"#, "#BA0C2E"),
        (#"preto|black|space"#, "#1D1D1F"),
        (#"branco|white"#, "#F5F5F0"),
        (#"prata|prateado|silver"#, "#E3E4E5"),
        (#"azul|blue|ultramar"#, "#3D7EA6"),
        (#"verde|green|teal"#, "#ADC7B4"),
        (#"rosa|pink"#, "#F2C9CE"),
        (#"roxo|purple"#, "#B7A6D8"),
        (#"amarelo|yellow"#, "#F5E39A"),
        (#"dourado|gold"#, "#F4E3C1"),
        (#"laranja|orange|c[oó]smico"#, "#F77E2D"),
        (#"tit[aâ]nio|titanium"#, "#8D8D92"),
    ]

    /// Hex aproximado pelo nome da cor (nil se não reconhecer).
    public static func hexFromName(_ name: String?) -> String? {
        let n = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty else { return nil }
        for (pattern, hex) in rules where n.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil {
            return hex
        }
        return nil
    }

    /// "#abc", "abc", "#aabbcc", "AABBCC" → "#AABBCC"; inválido → nil.
    public static func normalize(_ value: String?) -> String? {
        guard var v = value?.trimmingCharacters(in: .whitespaces) else { return nil }
        if v.hasPrefix("#") { v.removeFirst() }
        let isHex = !v.isEmpty && v.allSatisfy(\.isHexDigit)
        guard isHex else { return nil }
        if v.count == 3 { v = v.map { "\($0)\($0)" }.joined() }
        guard v.count == 6 else { return nil }
        return "#" + v.uppercased()
    }

    public static func hex(_ name: String?, stored: String? = nil) -> String {
        normalize(stored) ?? hexFromName(name) ?? fallbackHex
    }

    /// Cor clara (luminância > 160): ganha borda sutil e ✓ escuro.
    public static func isLight(_ hex: String) -> Bool {
        let n = normalize(hex) ?? fallbackHex
        let value = Int(n.dropFirst(), radix: 16) ?? 0
        let r = Double((value >> 16) & 0xFF), g = Double((value >> 8) & 0xFF), b = Double(value & 0xFF)
        return 0.299 * r + 0.587 * g + 0.114 * b > 160
    }
}
