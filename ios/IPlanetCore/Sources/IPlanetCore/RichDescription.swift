import Foundation

/// Descrição rica de produto (products.description_md, migração 039).
/// Espelha `src/lib/catalog/rich-description.ts` (referência em docs/api-contract.md):
/// blocos `##`/`###`, parágrafo, lista, imagem sozinha na linha, tabela; inline só **negrito**.
/// Nunca interpreta HTML: `<tag>` sai como texto.
public enum RichDescription {
    public struct Inline: Equatable, Sendable {
        public var text: String
        public var bold: Bool
        public init(text: String, bold: Bool) { self.text = text; self.bold = bold }
    }

    public enum Block: Equatable, Sendable {
        case heading(level: Int, text: String)
        case paragraph([Inline])
        case list([[Inline]])
        case image(url: String, alt: String)
        case table(header: [String], rows: [[String]])

        public var kind: String {
            switch self {
            case .heading: "heading"
            case .paragraph: "paragraph"
            case .list: "list"
            case .image: "image"
            case .table: "table"
            }
        }
    }

    public static let maxChars = 20_000
    private static let storagePath = "/storage/v1/object/public/product-images/"

    private static func regex(_ p: String) -> NSRegularExpression { try! NSRegularExpression(pattern: p) }
    private static let localImage = regex(#"^/products/[A-Za-z0-9._\-/]+$"#)
    private static let supabaseHost = regex(#"^[a-z0-9-]+\.supabase\.co$"#)
    private static let boldRe = regex(#"\*\*(.+?)\*\*"#)
    private static let imageRe = regex(#"^!\[([^\]]*)\]\(\s*(\S+)\s*\)$"#)
    private static let tableSep = regex(#"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$"#)
    private static let headingRe = regex(#"^(#{2,3})\s+(.+)$"#)
    private static let h1Re = regex(#"^#\s+(.+)$"#)
    private static let listRe = regex(#"^[-*•]\s+(.+)$"#)

    private static func groups(_ re: NSRegularExpression, _ s: String) -> [String]? {
        let ns = s as NSString
        guard let m = re.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return (0..<m.numberOfRanges).map { m.range(at: $0).location == NSNotFound ? "" : ns.substring(with: m.range(at: $0)) }
    }

    private static func trim(_ s: some StringProtocol) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// Só o bucket público product-images (https, *.supabase.co) ou /products/ do site.
    public static func isAllowedImage(_ url: String) -> Bool {
        let u = trim(url)
        if groups(localImage, u) != nil && !u.contains("..") { return true }
        guard let c = URLComponents(string: u), c.scheme == "https", let host = c.host,
              groups(supabaseHost, host) != nil, c.user == nil, c.port == nil else { return false }
        let path = c.percentEncodedPath
        return path.hasPrefix(storagePath) && !path.contains("..") && !(c.path.contains(".."))
    }

    public static func parseInlines(_ text: String) -> [Inline] {
        let ns = text as NSString
        var out: [Inline] = []
        var last = 0
        for m in boldRe.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            if m.range.location > last { out.append(Inline(text: ns.substring(with: NSRange(location: last, length: m.range.location - last)), bold: false)) }
            out.append(Inline(text: ns.substring(with: m.range(at: 1)), bold: true))
            last = m.range.location + m.range.length
        }
        if last < ns.length { out.append(Inline(text: ns.substring(from: last), bold: false)) }
        return out.filter { !$0.text.isEmpty }
    }

    private static func splitRow(_ line: String) -> [String] {
        var s = trim(line)
        if s.hasPrefix("|") { s.removeFirst() }
        if s.hasSuffix("|") { s.removeLast() }
        return s.split(separator: "|", omittingEmptySubsequences: false).map {
            let cell = trim($0) as NSString
            return boldRe.stringByReplacingMatches(in: cell as String, range: NSRange(location: 0, length: cell.length), withTemplate: "$1")
        }
    }

    public static func parse(_ source: String?) -> [Block] {
        guard let source, !source.isEmpty else { return [] }
        let clipped = String(source.utf16.prefix(maxChars)) ?? String(source.prefix(maxChars))
        let lines = clipped.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
            .components(separatedBy: "\n")
        var blocks: [Block] = []
        var para: [String] = []
        var list: [[Inline]]?

        func flushPara() {
            if !para.isEmpty { blocks.append(.paragraph(parseInlines(para.joined(separator: " ")))); para = [] }
        }
        func flushList() {
            if let l = list { blocks.append(.list(l)); list = nil }
        }

        var i = 0
        while i < lines.count {
            defer { i += 1 }
            let line = trim(lines[i])
            if line.isEmpty { flushPara(); flushList(); continue }
            if let h = groups(headingRe, line) {
                flushPara(); flushList()
                blocks.append(.heading(level: h[1] == "###" ? 3 : 2, text: trim(h[2].replacingOccurrences(of: "**", with: ""))))
                continue
            }
            if let h = groups(h1Re, line) {
                flushPara(); flushList()
                blocks.append(.heading(level: 2, text: trim(h[1].replacingOccurrences(of: "**", with: ""))))
                continue
            }
            if let img = groups(imageRe, line) {
                flushPara(); flushList()
                if isAllowedImage(img[2]) { blocks.append(.image(url: img[2], alt: trim(img[1]))) }
                continue
            }
            if line.hasPrefix("|"), i + 1 < lines.count, groups(tableSep, trim(lines[i + 1])) != nil {
                flushPara(); flushList()
                let header = splitRow(line)
                var rows: [[String]] = []
                var j = i + 2
                while j < lines.count, trim(lines[j]).hasPrefix("|") {
                    let cells = splitRow(lines[j])
                    rows.append(header.indices.map { $0 < cells.count ? cells[$0] : "" })
                    j += 1
                }
                i = j - 1
                blocks.append(.table(header: header, rows: rows))
                continue
            }
            if let li = groups(listRe, line) {
                flushPara()
                list = (list ?? []) + [parseInlines(li[1])]
                continue
            }
            flushList()
            para.append(line)
        }
        flushPara(); flushList()
        return blocks
    }

    /// Texto curto sem marcação (fallback), como `richDescriptionPlainText`.
    public static func plainText(_ source: String?, max: Int = 220) -> String {
        let text = trim(parse(source).compactMap { b -> String? in
            if case .paragraph(let inl) = b { return inl.map(\.text).joined() }
            return nil
        }.joined(separator: " "))
        return text.count > max ? trim(text.prefix(max - 1)) + "…" : text
    }

    /// Descrição longa quando houver blocos; senão nil (usar `description` curta).
    public static func blocksOrNil(_ source: String?) -> [Block]? {
        let b = parse(source)
        return b.isEmpty ? nil : b
    }
}
