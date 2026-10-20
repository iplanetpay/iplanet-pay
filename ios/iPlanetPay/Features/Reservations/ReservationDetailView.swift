import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct ReservationDetailView: View {
    let reservationID: UUID
    @Environment(SessionStore.self) private var session
    @State private var reservation: ReservationRow?
    @State private var contributions: [Contribution] = []
    @State private var offers: [UsedDeviceOffer] = []
    @State private var pickups: [PickupRequest] = []
    @State private var products: [Product] = []
    @State private var error: String?
    @State private var info: String?
    @State private var loading = true
    @State private var showAporte = false
    @State private var showTradeIn = false
    @State private var showWithdraw = false
    @State private var showSwitch = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if loading && reservation == nil {
                    ProgressView()
                }
                if let reservation {
                    content(reservation)
                }
                if let error {
                    Text(error).foregroundStyle(Brand.danger)
                }
                if let info {
                    Text(info).foregroundStyle(Brand.inkMuted)
                }
            }
            .padding(20)
        }
        .background(Brand.backgroundSubtle)
        .navigationTitle("Reserva")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showAporte) {
            if let reservation {
                AporteSheet(reservation: reservation) {
                    showAporte = false
                    Task { await load() }
                }
            }
        }
        .sheet(isPresented: $showTradeIn) {
            TradeInSheet(reservationID: reservationID) {
                showTradeIn = false
                Task { await load() }
            }
        }
        .sheet(isPresented: $showWithdraw) {
            if let reservation {
                WithdrawalSheet(reservation: reservation) {
                    showWithdraw = false
                    Task { await load() }
                }
            }
        }
        .sheet(isPresented: $showSwitch) {
            SwitchSheet(products: products) { productId in
                Task { await switchTo(productId) }
            }
        }
    }

    @ViewBuilder
    private func content(_ reservation: ReservationRow) -> some View {
        RemoteImage(url: AppConfig.media(reservation.product?.imageUrl))
        HStack {
            Text(reservation.product?.name ?? "Reserva")
                .font(.title2.weight(.bold))
            Spacer()
            StatusPill(text: reservation.statusLabel, tone: tone(reservation.status))
        }
        Text(reservation.product?.subtitle ?? "")
            .foregroundStyle(Brand.inkMuted)
        Text(reservation.store?.name ?? "Loja")
            .font(.subheadline)
        ProgressTrack(value: reservation.progress)
        Text("\(Money.format(cents: reservation.amountPaidCents)) de \(Money.format(cents: reservation.listPriceCents))")
            .font(.headline)
        Text("Faltam \(Money.format(cents: reservation.remainingCents))")
            .foregroundStyle(Brand.inkMuted)
        if reservation.status == "ativa" {
            Button("Fazer aporte") { showAporte = true }
                .buttonStyle(PrimaryButtonStyle())
            Button("Trocar aparelho") { showSwitch = true }
                .buttonStyle(SecondaryButtonStyle())
            Button("Oferecer usado") { showTradeIn = true }
                .buttonStyle(SecondaryButtonStyle())
            Button("Cancelar reserva", role: .destructive) {
                Task { await cancel() }
            }
            .frame(maxWidth: .infinity)
        }
        if reservation.amountPaidCents >= 100_000 {
            Button("Pedir saque") { showWithdraw = true }
                .buttonStyle(SecondaryButtonStyle())
        }
        if session.isAdmin && (reservation.status == "quitada" || reservation.progress >= 1) {
            Button("Confirmar retirada") {
                Task { await confirmPickup() }
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        if (session.profile?.bonusCents ?? 0) > 0 && reservation.status == "ativa" {
            Button("Aplicar bônus de indicação") {
                Task { await applyBonus() }
            }
            .buttonStyle(SecondaryButtonStyle())
        }
        sectionTitle("Aportes")
        if contributions.isEmpty {
            Text("Nenhum aporte ainda. O mínimo é R$ 5,00.")
                .foregroundStyle(Brand.inkMuted)
        }
        ForEach(contributions) { contribution in
            BrandCard {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(Money.format(cents: contribution.amountCents))
                            .font(.headline)
                        Spacer()
                        StatusPill(text: contribution.statusLabel, tone: contribution.status == "confirmed" ? .success : .lavender)
                    }
                    if let created = contribution.createdAt {
                        Text(DatesPT.mediumTime(created))
                            .font(.caption)
                            .foregroundStyle(Brand.inkMuted)
                    }
                    if let code = contribution.pixCode, !code.isEmpty {
                        Text(code)
                            .font(.caption.monospaced())
                            .textSelection(.enabled)
                        Button("Copiar Pix") {
                            UIPasteboard.general.string = code
                            info = "Código Pix copiado."
                        }
                        .font(.subheadline.weight(.semibold))
                    }
                    if let image = qrImage(contribution.pixQrBase64) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: 220)
                    }
                    if session.isAdmin && contribution.status == "pending" {
                        Button("Confirmar aporte") {
                            Task { await confirm(contribution) }
                        }
                        .font(.subheadline.weight(.semibold))
                    }
                }
            }
        }
        Text(LegalCopy.pixServerNote)
            .font(.footnote)
            .foregroundStyle(Brand.inkMuted)
        if !offers.isEmpty {
            sectionTitle("Usados")
            ForEach(offers) { offer in
                BrandCard {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(offer.deviceModel).font(.headline)
                        Text("IMEI \(offer.imei)").font(.caption).foregroundStyle(Brand.inkMuted)
                        Text(offer.statusLabel)
                        Text("Esperado \(Money.format(cents: offer.expectedValueCents))")
                            .font(.subheadline)
                    }
                }
            }
        }
        if !pickups.isEmpty {
            sectionTitle("Retirada ou envio")
            ForEach(pickups) { pickup in
                BrandCard {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(pickup.modeLabel).font(.headline)
                        Text(pickup.status)
                        if let tracking = pickup.trackingCode {
                            Text("Rastreio \(tracking)")
                        }
                    }
                }
            }
        } else if reservation.progress >= 0.7 {
            Text("Pedido de retirada ou envio continua no site, porque a gravação usa o servidor. Acompanhe o status aqui.")
                .font(.footnote)
                .foregroundStyle(Brand.inkMuted)
            Link("Abrir reserva no Safari", destination: AppConfig.web("/app/reserva/\(reservation.id.uuidString)"))
        }
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title).font(.title3.weight(.bold)).padding(.top, 8)
    }

    private func tone(_ status: String) -> StatusPill.PillTone {
        switch status {
        case "ativa": .accent
        case "quitada": .success
        case "cancelada": .danger
        case "retirada", "saque_pendente": .lavender
        default: .neutral
        }
    }

    private func qrImage(_ raw: String?) -> UIImage? {
        guard var raw, !raw.isEmpty else { return nil }
        if let range = raw.range(of: "base64,") {
            raw = String(raw[range.upperBound...])
        }
        guard let data = Data(base64Encoded: raw) else { return nil }
        return UIImage(data: data)
    }

    private func load() async {
        loading = reservation == nil
        defer { loading = false }
        do {
            reservation = try await Repository.reservation(id: reservationID)
            contributions = try await Repository.contributions(reservationId: reservationID)
            offers = try await Repository.offers(reservationId: reservationID)
            pickups = try await Repository.pickups(reservationId: reservationID)
            products = try await Repository.products()
            error = nil
        } catch {
            self.error = describeError(error)
        }
    }

    private func cancel() async {
        do {
            try await Repository.cancelReservation(id: reservationID)
            info = "Reserva cancelada."
            await load()
        } catch {
            self.error = describeError(error)
        }
    }

    private func switchTo(_ productId: UUID) async {
        do {
            _ = try await Repository.switchReservation(id: reservationID, productId: productId)
            showSwitch = false
            info = "Aparelho trocado. A nova reserva aparece no início."
            await load()
        } catch {
            self.error = describeError(error)
        }
    }

    private func confirmPickup() async {
        do {
            try await Repository.confirmRetirada(id: reservationID)
            await load()
        } catch {
            self.error = describeError(error)
        }
    }

    private func confirm(_ contribution: Contribution) async {
        do {
            try await Repository.adminConfirmContribution(id: contribution.id)
            await load()
        } catch {
            self.error = describeError(error)
        }
    }

    private func applyBonus() async {
        do {
            try await Repository.applyBonus(reservationId: reservationID)
            await session.refreshProfile()
            await load()
        } catch {
            self.error = describeError(error)
        }
    }
}

struct AporteSheet: View {
    let reservation: ReservationRow
    var onDone: () -> Void
    @Environment(SessionStore.self) private var session
    @State private var amount = ""
    @State private var reachedEnd = false
    @State private var accepted = false
    @State private var contractFrame: CGRect = .zero
    @State private var contractViewport: CGFloat = 0
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("Mínimo \(Money.format(cents: LegalCopy.minimumContributionCents)). Restam \(Money.format(cents: reservation.remainingCents)).")
                    .foregroundStyle(Brand.inkMuted)
                TextField("Valor em reais", text: $amount)
                    .keyboardType(.decimalPad)
                    .padding(14)
                    .background(Brand.backgroundSubtle)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                ScrollView {
                    Text(LegalCopy.aporteContract)
                        .font(.footnote)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            GeometryReader { proxy in
                                Color.clear.preference(
                                    key: ContractFrameKey.self,
                                    value: proxy.frame(in: .named("contract"))
                                )
                            }
                        )
                }
                .coordinateSpace(name: "contract")
                .frame(maxHeight: 280)
                .background(
                    GeometryReader { proxy in
                        Color.clear.preference(key: ContractViewportKey.self, value: proxy.size.height)
                    }
                )
                .onPreferenceChange(ContractFrameKey.self) { frame in
                    contractFrame = frame
                    updateReachedEnd()
                }
                .onPreferenceChange(ContractViewportKey.self) { height in
                    contractViewport = height
                    updateReachedEnd()
                }
                .background(Brand.backgroundSubtle)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                Toggle("Li o contrato até o fim e aceito este aporte", isOn: $accepted)
                    .disabled(!reachedEnd)
                if let message {
                    Text(message).foregroundStyle(Brand.danger)
                }
                Button(busy ? "Criando…" : "Criar aporte") {
                    Task { await submit() }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy || !accepted)
                Text(LegalCopy.pixServerNote)
                    .font(.footnote)
                    .foregroundStyle(Brand.inkMuted)
            }
            .padding(20)
            .navigationTitle("Aporte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { onDone() }
                }
            }
        }
    }

    private func updateReachedEnd() {
        guard contractViewport > 0, contractFrame != .zero else { return }
        reachedEnd = contractFrame.maxY <= contractViewport + 24
    }

    private func submit() async {
        guard let userId = session.profile?.id else { return }
        if session.signedInWithGoogle && session.profile?.identityComplete != true {
            message = "Complete seu cadastro antes de fazer um aporte."
            return
        }
        guard let cents = Money.cents(from: amount), cents >= LegalCopy.minimumContributionCents || cents == reservation.remainingCents else {
            message = "Valor mínimo de R$ 5,00 por aporte."
            return
        }
        busy = true
        defer { busy = false }
        do {
            let contractId = try await Repository.acceptAporteContract(userId: userId, reservationId: reservation.id)
            let contributionId = try await Repository.createContribution(reservationId: reservation.id, amountCents: cents)
            try? await Repository.linkContract(id: contractId, contributionId: contributionId, userId: userId)
            onDone()
        } catch {
            message = describeError(error)
        }
    }
}

struct SwitchSheet: View {
    let products: [Product]
    var onPick: (UUID) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(products) { product in
                Button {
                    onPick(product.id)
                    dismiss()
                } label: {
                    VStack(alignment: .leading) {
                        Text(product.name)
                        Text(Money.format(cents: product.listPriceCents))
                            .font(.caption)
                            .foregroundStyle(Brand.inkMuted)
                    }
                }
            }
            .navigationTitle("Novo aparelho")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { dismiss() }
                }
            }
        }
    }
}

struct WithdrawalSheet: View {
    let reservation: ReservationRow
    var onDone: () -> Void
    @Environment(SessionStore.self) private var session
    @State private var pixKey = ""
    @State private var pixType = "cpf"
    @State private var holder = ""
    @State private var cpf = ""
    @State private var message: String?
    @State private var busy = false

    private let types = ["cpf", "cnpj", "email", "phone", "random"]

    var body: some View {
        NavigationStack {
            Form {
                Text("O saque vale para aportes confirmados acima de R$ 1.000, depois de 15 dias de conta. A taxa é de 30%.")
                    .font(.footnote)
                TextField("Nome do titular", text: $holder)
                TextField("CPF do titular", text: $cpf)
                Picker("Tipo da chave", selection: $pixType) {
                    ForEach(types, id: \.self) { Text($0).tag($0) }
                }
                TextField("Chave Pix", text: $pixKey)
                if let message {
                    Text(message).foregroundStyle(Brand.danger)
                }
                Button(busy ? "Enviando…" : "Solicitar saque") {
                    Task { await submit() }
                }
                .disabled(busy)
            }
            .navigationTitle("Saque")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { onDone() }
                }
            }
            .onAppear {
                holder = session.profile?.fullName ?? ""
                cpf = session.profile?.cpf ?? ""
                pixKey = session.profile?.pixKey ?? ""
                pixType = session.profile?.pixKeyType ?? "cpf"
            }
        }
    }

    private func submit() async {
        busy = true
        defer { busy = false }
        do {
            try await Repository.requestWithdrawal(
                RPC.Withdrawal(
                    pReservationId: reservation.id,
                    pPixKey: pixKey.trimmingCharacters(in: .whitespacesAndNewlines),
                    pPixKeyType: pixType,
                    pHolderFullName: holder.trimmingCharacters(in: .whitespacesAndNewlines),
                    pHolderCpf: BrazilID.normalizeCPF(cpf) ?? cpf
                )
            )
            onDone()
        } catch {
            message = describeError(error)
        }
    }
}

struct TradeInSheet: View {
    let reservationID: UUID
    var onDone: () -> Void
    @Environment(SessionStore.self) private var session
    @State private var model = ""
    @State private var imei = ""
    @State private var expected = ""
    @State private var minimum = ""
    @State private var liquid = false
    @State private var battery = ""
    @State private var batteryReason = ""
    @State private var maintenance: Set<String> = []
    @State private var photos: [Data] = []
    @State private var picker: [PhotosPickerItem] = []
    @State private var message: String?
    @State private var busy = false

    private let options: [(String, String)] = [
        ("troca_tela", "Troca de tela"),
        ("troca_bateria", "Troca de bateria"),
        ("troca_camera", "Troca de câmera"),
        ("reparo_placa", "Reparo em placa"),
        ("nunca_aberto", "Nunca foi aberto"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                TextField("Modelo", text: $model)
                TextField("IMEI", text: $imei)
                TextField("Valor esperado (R$)", text: $expected)
                    .keyboardType(.decimalPad)
                TextField("Valor mínimo (R$)", text: $minimum)
                    .keyboardType(.decimalPad)
                Toggle("Teve contato com líquido", isOn: $liquid)
                TextField("Saúde da bateria (0–100)", text: $battery)
                    .keyboardType(.numberPad)
                Picker("Se não souber a porcentagem", selection: $batteryReason) {
                    Text("Vou informar a %").tag("")
                    Text("Não sei").tag("unknown")
                    Text("Não se aplica").tag("not_applicable")
                }
                Section("Manutenção") {
                    ForEach(options, id: \.0) { option in
                        Toggle(option.1, isOn: binding(option.0))
                    }
                }
                PhotosPicker(selection: $picker, maxSelectionCount: 5, matching: .images) {
                    Label("Fotos (\(photos.count))", systemImage: "photo")
                }
                .onChange(of: picker) { _, items in
                    Task { await loadPhotos(items) }
                }
                if let message {
                    Text(message).foregroundStyle(Brand.danger)
                }
                Button(busy ? "Enviando…" : "Enviar avaliação") {
                    Task { await submit() }
                }
                .disabled(busy)
            }
            .navigationTitle("Usado")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { onDone() }
                }
            }
        }
    }

    private func binding(_ id: String) -> Binding<Bool> {
        Binding(
            get: { maintenance.contains(id) },
            set: { isOn in
                if isOn { maintenance.insert(id) } else { maintenance.remove(id) }
            }
        )
    }

    private func loadPhotos(_ items: [PhotosPickerItem]) async {
        var loaded: [Data] = []
        for item in items {
            if let photo = try? await item.loadTransferable(type: PickedPhoto.self) {
                loaded.append(photo.data)
            }
        }
        photos = loaded
    }

    private func submit() async {
        guard let userId = session.profile?.id else { return }
        let trimmedModel = model.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedImei = imei.filter { !$0.isWhitespace }
        guard !trimmedModel.isEmpty, !trimmedImei.isEmpty else {
            message = "Preencha modelo e IMEI."
            return
        }
        guard let expectedCents = Money.cents(from: expected), let minimumCents = Money.cents(from: minimum),
              expectedCents > 0, minimumCents > 0 else {
            message = "Informe valores esperado e mínimo válidos."
            return
        }
        guard minimumCents <= expectedCents else {
            message = "O valor mínimo não pode ser maior que o esperado."
            return
        }
        guard !maintenance.isEmpty else {
            message = "Selecione ao menos uma opção de manutenção."
            return
        }
        let batteryValue = Int(battery)
        let reason = batteryReason.isEmpty ? nil : batteryReason
        if reason == nil {
            guard let batteryValue, (0...100).contains(batteryValue) else {
                message = "Informe a saúde da bateria entre 0 e 100, ou escolha que não sabe."
                return
            }
        }
        guard !photos.isEmpty else {
            message = "Envie ao menos uma foto do aparelho."
            return
        }
        let offerId = UUID()
        let owner = userId.uuidString.lowercased()
        let offer = offerId.uuidString.lowercased()
        busy = true
        defer { busy = false }
        do {
            var paths: [String] = []
            for (index, data) in photos.enumerated() {
                let path = "\(owner)/\(offer)/\(index).jpg"
                try await Repository.uploadPhoto(bucket: "used-device-photos", path: path, data: data)
                paths.append(path)
            }
            let device = RPC.TradeIn.Device(
                id: offerId,
                deviceModel: trimmedModel,
                imei: trimmedImei,
                expectedValueCents: expectedCents,
                minimumValueCents: minimumCents,
                maintenanceOptions: Array(maintenance),
                liquidExposure: liquid,
                photoPaths: paths,
                batteryHealthPct: reason == nil ? batteryValue : nil,
                batteryHealthReason: reason
            )
            try await Repository.submitTradeIn(RPC.TradeIn(pReservationId: reservationID, pDevices: [device]))
            onDone()
        } catch {
            message = describeError(error)
        }
    }
}

private struct ContractFrameKey: PreferenceKey {
    static var defaultValue: CGRect { .zero }
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        value = nextValue()
    }
}

private struct ContractViewportKey: PreferenceKey {
    static var defaultValue: CGFloat { 0 }
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

struct PickedPhoto: Transferable {
    let data: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .image) { data in
            PickedPhoto(data: data)
        }
    }
}
