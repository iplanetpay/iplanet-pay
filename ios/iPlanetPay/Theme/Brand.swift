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

    enum PillTone: Sendable {
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

/// Esqueletos de carregamento: já nascem no layout final do conteúdo real e só pulsam a opacidade.
/// Nada desliza, cresce ou aparece com fade; com "Reduzir movimento" ficam estáticos.
struct SkeletonPulse: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            content.opacity(reduceMotion ? 0.75 : 0.55 + 0.35 * (0.5 + 0.5 * cos(t * 2 * .pi / 1.6)))
        }
        .transaction { $0.animation = nil }
        .transition(.identity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Carregando")
    }
}

/// Bloco cinza com o tamanho de um elemento real (texto, imagem, botão).
struct SkeletonBox: View {
    var width: CGFloat? = nil
    var height: CGFloat
    var radius: CGFloat = 8

    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(Brand.line)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
    }
}

/// Cartão com a mesma moldura do BrandCard.
private struct SkeletonCard<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        BrandCard { content() }
    }
}

enum SkeletonLayout {
    case lines(Int)
    /// Início: cartão da reserva ativa (pílula, título, subtítulo, valor, imagem, anel + 2 botões).
    case reservationCard
    /// Catálogo: cartões com imagem de 96 pt à esquerda.
    case catalog(Int)
    /// Carteira: linhas de aporte (valor + status | data).
    case rows(Int)
    /// Metas: grade 2 colunas com anel de 88 pt e nome.
    case goals(Int)
    /// Reserva: título, subtítulo, imagem e cartão de progresso.
    case reservationDetail
}

struct LoadingSkeleton: View {
    var layout: SkeletonLayout

    init(lines: Int = 3) { layout = .lines(lines) }
    init(_ layout: SkeletonLayout) { self.layout = layout }

    var body: some View {
        Group {
            switch layout {
            case .lines(let n):
                SkeletonCard {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(0..<n, id: \.self) { i in
                            SkeletonBox(width: i == n - 1 ? 160 : nil, height: i == 0 ? 22 : 14)
                        }
                    }
                }
            case .reservationCard:
                SkeletonCard {
                    VStack(alignment: .leading, spacing: 12) {
                        SkeletonBox(width: 110, height: 24, radius: 12)
                        SkeletonBox(width: 220, height: 28)
                        SkeletonBox(width: 140, height: 18)
                        SkeletonBox(width: 150, height: 18)
                        SkeletonBox(height: 160, radius: 20)
                        HStack(alignment: .center) {
                            Circle().stroke(Brand.line, lineWidth: 10).frame(width: 96, height: 96)
                            Spacer()
                            VStack(spacing: 8) {
                                SkeletonBox(width: 150, height: 50, radius: 16)
                                SkeletonBox(width: 150, height: 50, radius: 16)
                            }
                        }
                    }
                }
            case .catalog(let n):
                VStack(spacing: 16) {
                    ForEach(0..<n, id: \.self) { _ in
                        SkeletonCard {
                            HStack(alignment: .top, spacing: 12) {
                                SkeletonBox(width: 96, height: 120, radius: 20)
                                VStack(alignment: .leading, spacing: 6) {
                                    SkeletonBox(width: 70, height: 14)
                                    SkeletonBox(height: 20)
                                    SkeletonBox(width: 120, height: 16)
                                    SkeletonBox(width: 90, height: 14)
                                    SkeletonBox(width: 100, height: 20)
                                    SkeletonBox(width: 120, height: 16)
                                }
                            }
                        }
                    }
                }
            case .rows(let n):
                VStack(spacing: 16) {
                    ForEach(0..<n, id: \.self) { _ in
                        SkeletonCard {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    SkeletonBox(width: 110, height: 20)
                                    SkeletonBox(width: 80, height: 13)
                                }
                                Spacer()
                                SkeletonBox(width: 70, height: 13)
                            }
                        }
                    }
                }
            case .goals(let n):
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    ForEach(0..<n, id: \.self) { _ in
                        VStack(spacing: 8) {
                            Circle().stroke(Brand.line, lineWidth: 9).frame(width: 88, height: 88)
                            SkeletonBox(width: 90, height: 16)
                        }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .padding(.vertical, 12)
                        .background(Brand.background)
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Brand.line, lineWidth: 1))
                    }
                }
            case .reservationDetail:
                VStack(alignment: .leading, spacing: 16) {
                    SkeletonBox(width: 220, height: 30)
                    SkeletonBox(width: 150, height: 18)
                    SkeletonBox(height: 200, radius: 20)
                    SkeletonCard {
                        VStack(alignment: .leading, spacing: 12) {
                            SkeletonBox(width: 140, height: 20)
                            SkeletonBox(height: 10, radius: 5)
                            SkeletonBox(width: 180, height: 14)
                        }
                    }
                }
            }
        }
        .modifier(SkeletonPulse())
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
                Brand.line.modifier(SkeletonPulse())
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
