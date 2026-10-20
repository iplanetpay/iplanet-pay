import IPlanetCore
import SwiftUI

struct CatalogView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router
    @State private var products: [Product] = []
    @State private var stores: [Store] = []
    @State private var query = ""
    @State private var category = "Todos"
    @State private var error: String?
    @State private var loading = true
    @State private var selected: Product?
    @State private var variants: [ProductVariant] = []

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Reserve e aporte via Pix no seu ritmo.")
                        .foregroundStyle(Brand.inkMuted)
                    TextField("Buscar", text: $query)
                        .padding(12)
                        .background(Brand.background)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(categories, id: \.self) { item in
                                Button(item) { category = item }
                                    .font(.subheadline.weight(.semibold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(category == item ? Brand.accent : Brand.background)
                                    .foregroundStyle(category == item ? Color.white : Brand.ink)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    if let error {
                        Text(error).foregroundStyle(Brand.danger)
                    }
                    if loading {
                        LoadingSkeleton(lines: 5)
                    }
                    ForEach(filtered) { product in
                        Button {
                            selected = product
                        } label: {
                            BrandCard {
                                HStack(alignment: .top, spacing: 12) {
                                    RemoteImage(url: AppConfig.media(product.imageUrl))
                                        .frame(width: 96)
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(product.category ?? product.brand)
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(Brand.accent)
                                        Text(product.name)
                                            .font(.headline)
                                            .foregroundStyle(Brand.ink)
                                            .multilineTextAlignment(.leading)
                                        Text(product.subtitle)
                                            .font(.subheadline)
                                            .foregroundStyle(Brand.inkMuted)
                                        Text(Money.format(cents: product.listPriceCents))
                                            .font(.headline)
                                            .contentTransition(.numericText())
                                        Text("Escolher produto")
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(Brand.accent)
                                    }
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(20)
            }
            .background(Brand.backgroundSubtle)
            .navigationTitle("Catálogo")
            .refreshable { await load() }
            .task { await load() }
            .onChange(of: selected) { _, value in
                if value != nil { router.guideViewedProduct = true }
            }
            .sheet(item: $selected) { product in
                ProductReserveSheet(product: product, family: family(of: product), variants: variants, stores: stores) { reservationID in
                    selected = nil
                    router.reservationID = reservationID
                    router.selectedTab = .home
                }
            }
        }
    }

    /// Produtos do mesmo modelo (outras cores/armazenamentos são linhas próprias em `products`).
    private func family(of product: Product) -> [Product] {
        let key = product.model.trimmingCharacters(in: .whitespaces).lowercased()
        guard !key.isEmpty else { return [product] }
        return products.filter { $0.model.trimmingCharacters(in: .whitespaces).lowercased() == key && $0.category == product.category }
    }

    private var categories: [String] {
        let names = Set(products.compactMap(\.category)).sorted()
        return ["Todos"] + names
    }

    private var filtered: [Product] {
        products.filter { product in
            let matchesCategory = category == "Todos" || product.category == category
            let haystack = "\(product.name) \(product.model) \(product.storage) \(product.color ?? "")".lowercased()
            let matchesQuery = query.isEmpty || haystack.contains(query.lowercased())
            return matchesCategory && matchesQuery
        }
    }

    private func load() async {
        loading = products.isEmpty
        defer { loading = false }
        do {
            let loadedProducts = try await Repository.products()
            let loadedStores = try await Repository.stores()
            products = loadedProducts
            variants = (try? await Repository.productVariants()) ?? []
            stores = loadedStores
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }
}

struct ProductReserveSheet: View {
    let initial: Product
    let family: [Product]
    let variants: [ProductVariant]
    let stores: [Store]
    var onCreated: (UUID) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var storeId: UUID?
    @State private var message: String?
    @State private var busy = false
    @State private var color: String?
    @State private var storage: String?

    init(product: Product, family: [Product] = [], variants: [ProductVariant] = [], stores: [Store], onCreated: @escaping (UUID) -> Void) {
        self.initial = product
        self.family = family.isEmpty ? [product] : family
        self.variants = variants
        self.stores = stores
        self.onCreated = onCreated
    }

    private var matrix: VariantMatrix {
        var options: [VariantOption] = family.map {
            VariantOption(productId: $0.id, color: $0.color ?? "", storage: $0.storage, priceCents: $0.listPriceCents, imageUrl: $0.imageUrl)
        }
        // Cores extras de product_variants: mesmo produto, mesmo preço e imagem (como no site).
        for variant in variants {
            guard let owner = family.first(where: { $0.id == variant.productId }) else { continue }
            options.append(VariantOption(
                productId: owner.id,
                variantId: variant.id,
                color: variant.color ?? owner.color ?? "",
                storage: (variant.storage?.isEmpty == false ? variant.storage : nil) ?? owner.storage,
                priceCents: variant.priceCents,
                imageUrl: owner.imageUrl
            ))
        }
        return VariantMatrix(options: options)
    }

    /// Produto que vai para a reserva conforme a combinação escolhida.
    /// Combinação escolhida (com o id da variante e o preço dela).
    private var chosen: VariantOption? { matrix.resolve(color: color, storage: storage) }

    private var priceCents: Int { chosen?.priceCents ?? product.listPriceCents }

    private var product: Product {
        let id = matrix.resolve(color: color, storage: storage)?.productId ?? initial.id
        return family.first { $0.id == id } ?? initial
    }

    private var springy: Animation? {
        reduceMotion ? nil : .spring(response: 0.45, dampingFraction: 0.82)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    RemoteImage(url: AppConfig.media(product.imageUrl))
                        .id(product.imageUrl ?? product.id.uuidString)
                        .transition(.opacity.combined(with: .scale(scale: 0.96)))
                    Text(product.name).font(.title.weight(.bold))
                    Text(subtitle).foregroundStyle(Brand.inkMuted)
                        .contentTransition(.opacity)
                    Text(Money.format(cents: priceCents))
                        .font(.title2.weight(.bold))
                        .contentTransition(.numericText())
                    variantPickers
                    if let description = product.description, !description.isEmpty {
                        Text(description)
                    }
                    Text("Loja de retirada")
                        .font(.headline)
                    if stores.isEmpty {
                        Text("Nenhuma loja disponível.")
                            .foregroundStyle(Brand.inkMuted)
                    } else {
                        Picker("Loja", selection: $storeId) {
                            Text("Escolha").tag(Optional<UUID>.none)
                            ForEach(stores) { store in
                                Text(storeLabel(store)).tag(Optional(store.id))
                            }
                        }
                        .pickerStyle(.inline)
                    }
                    if let message {
                        Text(message).foregroundStyle(Brand.danger)
                    }
                    Button(busy ? "Reservando…" : (chosen?.variantId != nil ? "Reservar \(VariantMatrix.label(chosen!))" : "Reservar")) {
                        Task { await reserve() }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(busy || storeId == nil)
                }
                .padding(20)
            }
            .background(Brand.backgroundSubtle)
            .navigationTitle("Reservar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { dismiss() }
                }
            }
            .onAppear {
                if storeId == nil { storeId = stores.first?.id }
                if color == nil { color = initial.color?.trimmingCharacters(in: .whitespaces) }
                if storage == nil { storage = initial.storage.trimmingCharacters(in: .whitespaces) }
            }
        }
    }

    private var subtitle: String {
        [storage, color].compactMap { $0?.isEmpty == false ? $0 : nil }.joined(separator: " · ")
    }

    @ViewBuilder
    private var variantPickers: some View {
        let m = matrix
        if !m.colors.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 4) {
                    Text("Cor").font(.headline)
                    if let color, !color.isEmpty {
                        Text("· \(color)").foregroundStyle(Brand.inkMuted)
                    }
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 14) {
                        ForEach(m.colors, id: \.self) { name in
                            let available = m.isAvailable(color: name, storage: storage) || m.storages.isEmpty
                            let isOn = name.lowercased() == (color ?? "").lowercased()
                            Button { pick(color: name) } label: {
                                VStack(spacing: 6) {
                                    Circle()
                                        .fill(Color(hex: ColorSwatch.hex(name)))
                                        .frame(width: 34, height: 34)
                                        .overlay(Circle().strokeBorder(Color.black.opacity(0.12)))
                                        .padding(3)
                                        .overlay(Circle().strokeBorder(isOn ? Brand.accent : .clear, lineWidth: 2))
                                        .scaleEffect(isOn ? 1.06 : 1)
                                    Text(name).font(.caption2).foregroundStyle(isOn ? Brand.ink : Brand.inkMuted)
                                        .lineLimit(1)
                                }
                                .opacity(available ? 1 : 0.4)
                                .overlay(alignment: .top) {
                                    if !available {
                                        Rectangle().fill(Brand.inkMuted).frame(width: 40, height: 1.5).rotationEffect(.degrees(-45)).offset(y: 20)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Cor \(name)\(available ? "" : ", indisponível")")
                            .accessibilityAddTraits(isOn ? .isSelected : [])
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        if !m.storages.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Armazenamento").font(.headline)
                FlowChips(items: m.storages) { item in
                    let available = m.isAvailable(color: color, storage: item) || m.colors.isEmpty
                    let isOn = item.lowercased() == (storage ?? "").lowercased()
                    Button { pick(storage: item) } label: {
                        Text(item)
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 16)
                            .frame(minHeight: 40)
                            .background(isOn ? Brand.ink : Brand.background, in: Capsule())
                            .foregroundStyle(isOn ? Color.white : (available ? Brand.ink : Brand.inkMuted))
                            .overlay(Capsule().strokeBorder(isOn ? Color.clear : Brand.line))
                            .strikethrough(!available)
                    }
                    .buttonStyle(.plain)
                    .disabled(!available)
                    .accessibilityLabel("Armazenamento \(item)\(available ? "" : ", indisponível")")
                    .accessibilityAddTraits(isOn ? .isSelected : [])
                }
            }
        }
    }

    private func pick(color name: String) {
        Haptics.tap()
        let option = matrix.select(color: name, storage: storage, changed: .color)
        withAnimation(springy) {
            color = option?.color ?? name
            storage = option?.storage ?? storage
        }
    }

    private func pick(storage item: String) {
        Haptics.tap()
        let option = matrix.select(color: color, storage: item, changed: .storage)
        withAnimation(springy) {
            storage = option?.storage ?? item
            color = option?.color ?? color
        }
    }

    private func storeLabel(_ store: Store) -> String {
        if let city = store.city, !city.isEmpty {
            return "\(store.name) · \(city)"
        }
        return store.name
    }

    private func reserve() async {
        guard let storeId else { return }
        busy = true
        defer { busy = false }
        do {
            let id = try await Repository.createReservation(productId: product.id, storeId: storeId, variantId: chosen?.variantId)
            onCreated(id)
        } catch {
            message = describeError(error)
        }
    }
}

/// Chips que quebram linha (armazenamentos).
private struct FlowChips<Item: Hashable, Content: View>: View {
    let items: [Item]
    @ViewBuilder var content: (Item) -> Content

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 10) { ForEach(items, id: \.self) { content($0) } }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 10)], alignment: .leading, spacing: 10) {
                ForEach(items, id: \.self) { content($0) }
            }
        }
    }
}

extension Color {
    /// "#RRGGBB" → Color.
    init(hex: String) {
        let raw = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let value = UInt64(raw, radix: 16) ?? 0xC7C7CC
        self.init(red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255, blue: Double(value & 0xFF) / 255)
    }
}
