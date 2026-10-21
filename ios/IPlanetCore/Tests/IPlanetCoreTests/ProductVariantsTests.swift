import XCTest
@testable import IPlanetCore

final class ProductVariantsTests: XCTestCase {
    let a = UUID(), b = UUID(), c = UUID()

    var matrix: VariantMatrix {
        VariantMatrix(options: [
            VariantOption(productId: b, color: "Preto", storage: "256GB", priceCents: 899_900, imageUrl: nil),
            VariantOption(productId: a, color: "Preto", storage: "128GB", priceCents: 799_900, imageUrl: "a.png"),
            VariantOption(productId: a, color: "Azul ", storage: "128GB", priceCents: 799_900, imageUrl: "a.png"),
            VariantOption(productId: c, color: "Preto", storage: "1TB", priceCents: 1_299_900, imageUrl: nil),
            VariantOption(productId: a, color: "preto", storage: "128gb", priceCents: 1, imageUrl: nil),
        ])
    }

    func testListsAndSortsDimensions() {
        XCTAssertEqual(matrix.colors, ["Preto", "Azul"])
        XCTAssertEqual(matrix.storages, ["128GB", "256GB", "1TB"])
        XCTAssertEqual(matrix.options.count, 4)
    }

    func testResolveAndAvailability() {
        XCTAssertEqual(matrix.resolve(color: "Preto", storage: "256GB")?.productId, b)
        XCTAssertEqual(matrix.resolve(color: "azul", storage: "128GB")?.productId, a)
        XCTAssertFalse(matrix.isAvailable(color: "Azul", storage: "1TB"))
    }

    func testSelectFallsBackKeepingChangedDimension() {
        XCTAssertEqual(matrix.select(color: "Azul", storage: "1TB", changed: .color)?.storage, "128GB")
        XCTAssertEqual(matrix.select(color: "Azul", storage: "1TB", changed: .storage)?.productId, c)
    }

    func testVariantIdsPricesAndFallback() {
        let v1 = UUID(), v2 = UUID()
        let m = VariantMatrix(options: [
            VariantOption(productId: a, color: "Lavanda", storage: "256 GB", priceCents: 799_900, imageUrl: nil),
            VariantOption(productId: a, variantId: v1, color: "Lavanda", storage: "512 GB", priceCents: 949_900, imageUrl: nil),
            VariantOption(productId: a, variantId: v2, color: "Preto", storage: "256 GB", priceCents: 799_900, imageUrl: nil),
            VariantOption(productId: a, variantId: UUID(), color: "Azul", storage: "128 GB", priceCents: 0, imageUrl: nil),
        ])
        XCTAssertEqual(m.colors, ["Lavanda", "Preto"])
        XCTAssertNil(m.resolve(color: "Lavanda", storage: "256 GB")?.variantId)
        XCTAssertEqual(m.resolve(color: "Lavanda", storage: "512 GB")?.priceCents, 949_900)
        let black = m.select(color: "Preto", storage: "512 GB", changed: .color)
        XCTAssertEqual(black?.variantId, v2)
        XCTAssertEqual(black.map(VariantMatrix.label), "256 GB · Preto")
        XCTAssertEqual(VariantMatrix.label(fromNotes: "Variante: 256 GB · Preto"), "256 GB · Preto")
        XCTAssertNil(VariantMatrix.label(fromNotes: "outra coisa"))
    }

    func testCapacityAndSwatch() {
        XCTAssertEqual(VariantMatrix.capacityGB("1TB"), 1024)
        XCTAssertEqual(VariantMatrix.capacityGB("64 GB"), 64)
        XCTAssertEqual(ColorSwatch.hex("Titânio Natural"), "#BAB4A9")
        XCTAssertEqual(ColorSwatch.hex("Titânio preto"), "#3C3C3D")
        XCTAssertEqual(ColorSwatch.hex("Meia-noite"), "#232A31")
        XCTAssertEqual(ColorSwatch.hex("Space Gray"), "#535150")
        XCTAssertEqual(ColorSwatch.hex("Vermelho (PRODUCT)RED"), "#BA0C2E")
        XCTAssertEqual(ColorSwatch.hex("Laranja cósmico"), "#E07A3D")
        XCTAssertEqual(ColorSwatch.hex("Qualquer"), "#C7C7CC")
        XCTAssertEqual(ColorSwatch.hex("Preto", stored: "#abc"), "#AABBCC")
        XCTAssertEqual(ColorSwatch.hex("Preto", stored: "zz"), "#1D1D1F")
        XCTAssertNil(ColorSwatch.normalize("#12345"))
        XCTAssertEqual(ColorSwatch.normalize("aabbcc"), "#AABBCC")
        XCTAssertTrue(ColorSwatch.isLight("#F5F5F0"))
        XCTAssertFalse(ColorSwatch.isLight("#1D1D1F"))
        let m = VariantMatrix(options: [
            VariantOption(productId: a, color: "Lavanda", storage: "256 GB", priceCents: 1, imageUrl: nil),
            VariantOption(productId: a, color: "lavanda", colorHex: "#c9b8e9", storage: "512 GB", priceCents: 2, imageUrl: nil),
        ])
        XCTAssertEqual(m.hex(for: "Lavanda"), "#C9B8E9")
        XCTAssertEqual(m.hex(for: "Azul"), "#3D7EA6")
    }
}
