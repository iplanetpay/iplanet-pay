import IPlanetCore
import SwiftUI

/// Renderiza products.description_md com os mesmos blocos do site (rich-description.tsx).
/// Só blocos do parser do Core: nenhum HTML é interpretado.
struct RichDescriptionView: View {
    let blocks: [RichDescription.Block]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                view(for: block)
            }
        }
        .font(.system(size: 15))
        .foregroundStyle(Brand.inkMuted)
        .lineSpacing(3)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func view(for block: RichDescription.Block) -> some View {
        switch block {
        case .heading(let level, let text):
            Text(text)
                .font(level == 2 ? .system(size: 18, weight: .bold) : .system(size: 15, weight: .semibold))
                .tracking(level == 2 ? -0.2 : 0)
                .foregroundStyle(Brand.ink)
                .padding(.top, level == 2 ? 12 : 4)
                .accessibilityAddTraits(.isHeader)
        case .paragraph(let inlines):
            Self.text(inlines)
                .fixedSize(horizontal: false, vertical: true)
        case .list(let items):
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("•").foregroundStyle(Brand.accent).fontWeight(.bold)
                        Self.text(item).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.leading, 4)
        case .image(let url, let alt):
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(url: AppConfig.media(url), cornerRadius: 0)
                    .background(Color.white)
                    .accessibilityLabel(alt.isEmpty ? "Foto do produto" : alt)
                if !alt.isEmpty {
                    Text(alt).font(.caption).padding(.horizontal, 16).padding(.vertical, 8)
                }
            }
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Brand.line, lineWidth: 1))
        case .table(let header, let rows):
            SpecTable(header: header, rows: rows)
        }
    }

    /// Negrito como texto puro concatenado (sem interpretar Markdown/HTML de novo).
    static func text(_ inlines: [RichDescription.Inline]) -> Text {
        inlines.reduce(Text("")) { acc, i in
            acc + (i.bold ? Text(verbatim: i.text).fontWeight(.semibold).foregroundColor(Brand.ink) : Text(verbatim: i.text))
        }
    }
}

/// "Ficha técnica": cabeçalho em fundo suave, 1ª coluna em destaque, linhas separadas.
private struct SpecTable: View {
    let header: [String]
    let rows: [[String]]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Grid(alignment: .topLeading, horizontalSpacing: 0, verticalSpacing: 0) {
                GridRow {
                    ForEach(Array(header.enumerated()), id: \.offset) { _, h in
                        cell(h).fontWeight(.semibold).foregroundStyle(Brand.ink)
                    }
                }
                .background(Brand.backgroundSubtle)
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    Divider().gridCellUnsizedAxes(.horizontal)
                    GridRow {
                        ForEach(Array(row.enumerated()), id: \.offset) { k, c in
                            cell(c)
                                .fontWeight(k == 0 ? .medium : .regular)
                                .foregroundStyle(k == 0 ? Brand.ink : Brand.inkMuted)
                        }
                    }
                }
            }
            .frame(minWidth: 320, alignment: .leading)
        }
        .font(.subheadline)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Brand.line, lineWidth: 1))
    }

    private func cell(_ s: String) -> some View {
        Text(verbatim: s)
            .padding(.horizontal, 12).padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Galeria (image_url + product_images[]): swipe com indicador de página e tela cheia com zoom.
struct ProductGallery: View {
    let urls: [URL]
    @State private var index = 0
    @State private var fullscreen = false

    var body: some View {
        VStack(spacing: 10) {
            TabView(selection: $index) {
                ForEach(Array(urls.enumerated()), id: \.offset) { i, url in
                    RemoteImage(url: url)
                        .background(Color.white)
                        .contentShape(Rectangle())
                        .onTapGesture { fullscreen = true }
                        .accessibilityLabel("Foto \(i + 1) de \(urls.count)")
                        .accessibilityAddTraits(.isButton)
                        .tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 320)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            if urls.count > 1 {
                PageDots(count: urls.count, index: index)
            }
        }
        .onChange(of: urls) { index = 0 }
        .fullScreenCover(isPresented: $fullscreen) {
            FullscreenGallery(urls: urls, index: $index)
        }
    }
}

struct PageDots: View {
    let count: Int
    let index: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<count, id: \.self) { i in
                Capsule()
                    .fill(i == index ? Brand.accent : Brand.line)
                    .frame(width: i == index ? 18 : 7, height: 7)
            }
        }
        .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.8), value: index)
        .accessibilityElement()
        .accessibilityLabel("Foto \(index + 1) de \(count)")
    }
}

private struct FullscreenGallery: View {
    let urls: [URL]
    @Binding var index: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            TabView(selection: $index) {
                ForEach(Array(urls.enumerated()), id: \.offset) { i, url in
                    ZoomableImage(url: url).tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()
            VStack {
                HStack {
                    Text("\(index + 1) / \(urls.count)")
                        .font(.subheadline.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(.ultraThinMaterial, in: Capsule())
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(.ultraThinMaterial, in: Circle())
                    }
                    .accessibilityLabel("Fechar")
                }
                .padding(.horizontal, 16)
                Spacer()
            }
        }
        .statusBarHidden()
    }
}

/// Pinça para ampliar (1–4x), arrastar quando ampliada, toque duplo alterna 1x/2,5x.
private struct ZoomableImage: View {
    let url: URL
    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    var body: some View {
        AsyncImage(url: url) { phase in
            if let image = phase.image {
                image.resizable().scaledToFit()
            } else if phase.error != nil {
                Image(systemName: "photo").font(.largeTitle).foregroundStyle(.white.opacity(0.6))
            } else {
                ProgressView().tint(.white)
            }
        }
        .scaleEffect(scale)
        .offset(offset)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .gesture(
            MagnifyGesture()
                .onChanged { scale = min(4, max(1, lastScale * $0.magnification)) }
                .onEnded { _ in
                    lastScale = scale
                    if scale <= 1 { reset() }
                }
        )
        .simultaneousGesture(scale > 1 ? DragGesture()
            .onChanged { offset = CGSize(width: lastOffset.width + $0.translation.width, height: lastOffset.height + $0.translation.height) }
            .onEnded { _ in lastOffset = offset } : nil)
        .onTapGesture(count: 2) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                if scale > 1 { reset() } else { scale = 2.5; lastScale = 2.5 }
            }
        }
        .accessibilityLabel("Foto ampliada")
    }

    private func reset() {
        scale = 1; lastScale = 1; offset = .zero; lastOffset = .zero
    }
}
