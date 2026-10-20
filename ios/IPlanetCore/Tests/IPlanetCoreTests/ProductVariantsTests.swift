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

    func testCapacityAndSwatch() {
        XCTAssertEqual(VariantMatrix.capacityGB("1TB"), 1024)
        XCTAssertEqual(VariantMatrix.capacityGB("64 GB"), 64)
        XCTAssertEqual(ColorSwatch.hex("Titânio Natural"), "#8d8d92")
        XCTAssertEqual(ColorSwatch.hex("Meia-noite"), "#1d1d1f")
        XCTAssertEqual(ColorSwatch.hex("Qualquer"), "#c7c7cc")
    }
}
