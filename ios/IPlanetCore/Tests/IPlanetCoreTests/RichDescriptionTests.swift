import XCTest
@testable import IPlanetCore

final class RichDescriptionTests: XCTestCase {
    let img = "https://xeeogfmmasvgbpmodqym.supabase.co/storage/v1/object/public/product-images/iphone/x.jpg"

    func testParsesSectionsListsBoldImagesAndTables() {
        let md = "## Destaques\n- **A19 Pro** rápido\n- Tela grande\n\nTexto **forte** aqui.\n\n![Câmera](\(img))\n\n## Ficha técnica\n| Item | Detalhe |\n|---|---|\n| Tela | 6,9\" |\n| Chip | **A19 Pro** |"
        let b = RichDescription.parse(md)
        XCTAssertEqual(b.map(\.kind), ["heading", "list", "paragraph", "image", "heading", "table"])
        guard case .list(let items) = b[1] else { return XCTFail() }
        XCTAssertEqual(items[0][0], .init(text: "A19 Pro", bold: true))
        XCTAssertEqual(b[2], .paragraph([.init(text: "Texto ", bold: false), .init(text: "forte", bold: true), .init(text: " aqui.", bold: false)]))
        XCTAssertEqual(b[3], .image(url: img, alt: "Câmera"))
        XCTAssertEqual(b[4], .heading(level: 2, text: "Ficha técnica"))
        XCTAssertEqual(b[5], .table(header: ["Item", "Detalhe"], rows: [["Tela", "6,9\""], ["Chip", "A19 Pro"]]))
    }

    func testHeadingLevelsAndListBreaks() {
        let b = RichDescription.parse("# Topo\n### Sub\n#### Não\ntexto\n- a\n* b\n• c\ndepois")
        XCTAssertEqual(b, [
            .heading(level: 2, text: "Topo"),
            .heading(level: 3, text: "Sub"),
            .paragraph([.init(text: "#### Não texto", bold: false)]),
            .list([[.init(text: "a", bold: false)], [.init(text: "b", bold: false)], [.init(text: "c", bold: false)]]),
            .paragraph([.init(text: "depois", bold: false)]),
        ])
    }

    func testNeverYieldsHTMLAndDropsForeignImages() {
        let b = RichDescription.parse("<script>alert(1)</script>\n\n![x](https://evil.com/a.jpg)\n\n![y](javascript:alert(1))\n\n![z](https://abc.supabase.co/storage/v1/object/public/avatars/a.jpg)")
        // Igual ao regex do site: "javascript:alert(1))" não casa como imagem e fica como texto puro.
        XCTAssertEqual(b, [
            .paragraph([.init(text: "<script>alert(1)</script>", bold: false)]),
            .paragraph([.init(text: "![y](javascript:alert(1))", bold: false)]),
        ])
        XCTAssertFalse(b.contains { $0.kind == "image" })
        XCTAssertTrue(RichDescription.isAllowedImage(img))
        XCTAssertTrue(RichDescription.isAllowedImage("/products/iphone.png"))
        XCTAssertFalse(RichDescription.isAllowedImage("/products/../etc"))
        XCTAssertFalse(RichDescription.isAllowedImage("http://abc.supabase.co/storage/v1/object/public/product-images/a.jpg"))
        XCTAssertFalse(RichDescription.isAllowedImage("https://abc.supabase.co.evil.com/storage/v1/object/public/product-images/a.jpg"))
        XCTAssertFalse(RichDescription.isAllowedImage("https://abc.supabase.co/storage/v1/object/public/product-images/../avatars/a.jpg"))
    }

    func testPlainTextAndFallback() {
        XCTAssertEqual(RichDescription.plainText("## T\nOlá **mundo**.\n- item"), "Olá mundo.")
        XCTAssertNil(RichDescription.blocksOrNil(nil))
        XCTAssertNil(RichDescription.blocksOrNil("  \n\n"))
        XCTAssertNil(RichDescription.blocksOrNil("![x](https://evil.com/a.jpg)"))
    }
}
