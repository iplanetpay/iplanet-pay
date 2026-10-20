// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "IPlanetCore",
    platforms: [
        .iOS(.v18),
        .macOS(.v14),
    ],
    products: [
        .library(name: "IPlanetCore", targets: ["IPlanetCore"]),
    ],
    targets: [
        .target(name: "IPlanetCore"),
        .testTarget(name: "IPlanetCoreTests", dependencies: ["IPlanetCore"]),
    ]
)
