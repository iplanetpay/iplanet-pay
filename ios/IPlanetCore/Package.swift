// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "IPlanetCore",
    products: [
        .library(name: "IPlanetCore", targets: ["IPlanetCore"]),
    ],
    targets: [
        .target(name: "IPlanetCore"),
        .testTarget(name: "IPlanetCoreTests", dependencies: ["IPlanetCore"]),
    ]
)
