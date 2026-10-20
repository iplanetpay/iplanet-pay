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
                        ProgressView()
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
            .sheet(item: $selected) { product in
                ProductReserveSheet(product: product, stores: stores) { reservationID in
                    selected = nil
                    router.reservationID = reservationID
                    router.selectedTab = .home
                }
            }
        }
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
            stores = loadedStores
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }
}

struct ProductReserveSheet: View {
    let product: Product
    let stores: [Store]
    var onCreated: (UUID) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var storeId: UUID?
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    RemoteImage(url: AppConfig.media(product.imageUrl))
                    Text(product.name).font(.title.weight(.bold))
                    Text(product.subtitle).foregroundStyle(Brand.inkMuted)
                    Text(Money.format(cents: product.listPriceCents))
                        .font(.title2.weight(.bold))
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
                    Button(busy ? "Reservando…" : "Reservar") {
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
            }
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
            let id = try await Repository.createReservation(productId: product.id, storeId: storeId)
            onCreated(id)
        } catch {
            message = describeError(error)
        }
    }
}
