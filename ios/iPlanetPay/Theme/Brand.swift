import SwiftUI

enum Brand {
    static let background = Color("Background")
    static let backgroundSubtle = Color("BackgroundSubtle")
    static let ink = Color("Ink")
    static let inkMuted = Color("InkMuted")
    static let line = Color("Line")
    static let accent = Color("Accent")
    static let accentSoft = Color("AccentSoft")
    static let success = Color("Success")
    static let danger = Color("Danger")
    static let lavender = Color("Lavender")
    static let whatsapp = Color(red: 37 / 255, green: 211 / 255, blue: 102 / 255)

    static let cardRadius: CGFloat = 24
}

struct Wordmark: View {
    var height: CGFloat = 28
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Image(colorScheme == .dark ? "WordmarkLight" : "Wordmark")
            .resizable()
            .scaledToFit()
            .frame(height: height)
            .accessibilityLabel("iPlanet Pay")
    }
}

struct BrandCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.background)
            .clipShape(RoundedRectangle(cornerRadius: Brand.cardRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Brand.cardRadius, style: .continuous)
                    .stroke(Brand.line, lineWidth: 1)
            )
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var fill: Color = Brand.ink

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(fill)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .opacity(configuration.isPressed ? 0.82 : 1)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(Brand.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Brand.background)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Brand.line, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .opacity(configuration.isPressed ? 0.82 : 1)
    }
}

struct StatusPill: View {
    let text: String
    var tone: PillTone = .accent

    enum PillTone {
        case accent, success, danger, lavender, neutral
    }

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(background)
            .clipShape(Capsule())
    }

    private var background: Color {
        switch tone {
        case .accent: Brand.accentSoft
        case .success: Brand.success.opacity(0.15)
        case .danger: Brand.danger.opacity(0.12)
        case .lavender: Brand.lavender
        case .neutral: Brand.backgroundSubtle
        }
    }

    private var foreground: Color {
        switch tone {
        case .accent: Brand.accent
        case .success: Brand.success
        case .danger: Brand.danger
        case .lavender: Brand.ink
        case .neutral: Brand.inkMuted
        }
    }
}

struct EmptyPane: View {
    let title: String
    let message: String

    var body: some View {
        BrandCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.title3.weight(.bold))
                Text(message)
                    .font(.body)
                    .foregroundStyle(Brand.inkMuted)
            }
        }
    }
}

struct RemoteImage: View {
    let url: URL?
    var cornerRadius: CGFloat = 20

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                ZStack {
                    Brand.backgroundSubtle
                    ProgressView()
                }
            case .success(let image):
                image
                    .resizable()
                    .scaledToFit()
            case .failure:
                ZStack {
                    Brand.backgroundSubtle
                    Image(systemName: "iphone")
                        .font(.title)
                        .foregroundStyle(Brand.inkMuted)
                }
            @unknown default:
                Brand.backgroundSubtle
            }
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 120)
        .background(Brand.backgroundSubtle)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .accessibilityHidden(url == nil)
    }
}

struct ProgressTrack: View {
    let value: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Brand.line)
                Capsule()
                    .fill(Brand.accent)
                    .frame(width: max(0, min(1, value)) * proxy.size.width)
            }
        }
        .frame(height: 8)
        .accessibilityLabel("Progresso")
        .accessibilityValue("\(Int((value * 100).rounded())) por cento")
    }
}
