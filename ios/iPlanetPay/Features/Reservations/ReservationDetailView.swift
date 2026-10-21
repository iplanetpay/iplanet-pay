import CoreImage.CIFilterBuiltins
import IPlanetCore
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct ReservationDetailView: View {
    let reservationID: UUID
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router
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
    @State private var showSimulator = false
    @State private var showPickup = false
    @State private var goals: [PaymentGoal] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if loading && reservation == nil {
                    LoadingSkeleton(.reservationDetail)
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
        .task(id: pendingWatch) { await watchPendingPix() }
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
        .onChange(of: router.requestPixReservationID) { _, id in
            openPixIfRequested(id)
        }
        .onAppear { openPixIfRequested(router.requestPixReservationID) }
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
        .sheet(isPresented: $showSimulator) {
            if let reservation {
                SimulatorSheet(
                    products: products,
                    locked: SimulatorLock(
                        reservationId: reservation.id,
                        productId: reservation.productId,
                        productName: reservation.product?.name ?? "Produto da reserva",
                        listPriceCents: reservation.listPriceCents,
                        contributedCents: reservation.amountPaidCents
                    ),
                    priorPayments: GoalLinks.paid(contributions)
                ) { _ in
                    showSimulator = false
                    Task { await load() }
                }
            }
        }
        .sheet(isPresented: $showPickup) {
            if let reservation {
                PickupSheet(reservation: reservation) {
                    showPickup = false
                    Task { await load() }
                }
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
        Text(VariantMatrix.label(fromNotes: reservation.notes) ?? reservation.product?.subtitle ?? "")
            .foregroundStyle(Brand.inkMuted)
        Text(reservation.store?.name ?? "Loja")
            .font(.subheadline)
        ProgressRing(percent: reservation.progress * 100, caption: "Aportes")
        Text("Total: \(Money.format(cents: reservation.listPriceCents))")
        Text("Pago: \(Money.format(cents: reservation.amountPaidCents))")
            .font(.headline)
            .contentTransition(.numericText())
        Text("Restante: \(Money.format(cents: reservation.remainingCents))")
            .foregroundStyle(Brand.inkMuted)
            .contentTransition(.numericText())
        if let created = reservation.createdAt {
            Text("Criada em \(DatesPT.medium(created))")
                .font(.subheadline)
                .foregroundStyle(Brand.inkMuted)
        }
        aporteBlock(reservation)
        if reservation.status == "ativa" {
            let goalName = goals.first { $0.reservationId == reservation.id }?.name
            Button(goalName ?? "Simulador de aportes") { showSimulator = true }
                .buttonStyle(SecondaryButtonStyle())
            Button("Trocar aparelho") { showSwitch = true }
                .buttonStyle(SecondaryButtonStyle())
            Button("Oferecer usado") { showTradeIn = true }
                .buttonStyle(SecondaryButtonStyle())
            if reservation.amountPaidCents > 0 {
                Text(LegalCopy.cancelWithAportesNote)
                    .font(.footnote)
                    .foregroundStyle(Brand.inkMuted)
            }
            Button("Cancelar reserva", role: .destructive) {
                Task { await cancel() }
            }
            .frame(minHeight: 44)
            .frame(maxWidth: .infinity)
        }
        if reservation.progress >= 0.7 || reservation.status == "quitada",
           pickups.isEmpty,
           reservation.status != "retirada",
           reservation.status != "sacada" {
            Button("Solicitar retirada") { showPickup = true }
                .buttonStyle(PrimaryButtonStyle(fill: Brand.accent))
        }
        RankingCard(reservation: reservation)
        if let goal = goals.first(where: { $0.reservationId == reservation.id }) ?? goals.first(where: { $0.productId == reservation.productId }) {
            ReservationGoalCard(goal: goal, reservation: reservation, contributions: contributions)
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
        sectionTitle("Histórico de aportes")
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
                    if let code = contribution.pixCode, !code.isEmpty, contribution.status == "pending" {
                        Text(code)
                            .font(.caption.monospaced())
                            .textSelection(.enabled)
                        Button("Copiar código Pix") {
                            UIPasteboard.general.string = code
                            info = "Código Pix copiado."
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(minHeight: 44)
                        if let image = PixCodeImage.make(code) {
                            Image(uiImage: image)
                                .interpolation(.none)
                                .resizable()
                                .scaledToFit()
                                .frame(maxWidth: 220)
                                .accessibilityLabel("QR Code do Pix")
                        }
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
                        if offer.isCounterOffer, let proposed = offer.approvedValueCents {
                            Text("Contra-proposta: \(Money.format(cents: proposed))")
                                .font(.subheadline.weight(.semibold))
                            HStack {
                                Button("Aceitar") { Task { await respond(offer, "accept") } }
                                    .buttonStyle(PrimaryButtonStyle())
                                Button("Recusar") { Task { await respond(offer, "reject") } }
                                    .buttonStyle(SecondaryButtonStyle())
                            }
                        }
                    }
                }
            }
        }
        if !pickups.isEmpty {
            sectionTitle("Retirada ou envio")
            ForEach(pickups) { pickup in
                BrandCard {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Retirada / envio — \(pickup.label)")
                            .font(.headline)
                        if let tracking = pickup.trackingCode, !tracking.isEmpty {
                            Text("Rastreio \(tracking)")
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func aporteBlock(_ reservation: ReservationRow) -> some View {
        if reservation.status == "ativa" {
            if session.profile?.identityComplete != true {
                Text("Complete seu cadastro antes de fazer um aporte.")
                    .font(.subheadline)
                    .foregroundStyle(Brand.inkMuted)
            } else {
                Button("Gerar aporte Pix") { showAporte = true }
                    .buttonStyle(PrimaryButtonStyle())
            }
        } else {
            Text(closedAporteMessage(reservation.status))
                .font(.subheadline)
                .foregroundStyle(Brand.inkMuted)
        }
    }

    private func closedAporteMessage(_ status: String) -> String {
        switch status {
        case "quitada": "Reserva quitada — aportes encerrados."
        case "retirada": "Reserva concluída."
        case "trocada": "Esta reserva foi trocada — aportes encerrados aqui."
        case "saque_pendente": "Saque em análise — aportes pausados."
        case "sacada": "Reserva sacada — aportes encerrados."
        default: "Não é possível gerar Pix nesta reserva."
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

    private var pendingWatch: String {
        contributions.filter { $0.status == "pending" }.map(\.id.uuidString).joined(separator: ",")
    }

    private func watchPendingPix() async {
        guard contributions.contains(where: { $0.status == "pending" }) else { return }
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            guard let fresh = try? await Repository.contributions(reservationId: reservationID) else { continue }
            let wasPending = Set(contributions.filter { $0.status == "pending" }.map(\.id))
            let nowConfirmed = fresh.contains { wasPending.contains($0.id) && $0.status == "confirmed" }
            contributions = fresh
            if nowConfirmed {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                info = "Aporte confirmado."
                if let userId = session.profile?.id {
                    reservation = try? await Repository.reservation(id: reservationID)
                    _ = userId
                } else {
                    reservation = try? await Repository.reservation(id: reservationID)
                }
                return
            }
        }
    }

    private func openPixIfRequested(_ id: UUID?) {
        guard id == reservationID else { return }
        showAporte = true
        router.requestPixReservationID = nil
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
            if let userId = session.profile?.id {
                goals = try await Repository.goals(userId: userId)
            }
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

    private func respond(_ offer: UsedDeviceOffer, _ action: String) async {
        do {
            try await Repository.respondTradeIn(offerId: offer.id, action: action)
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
    @State private var message: String?
    @State private var messageIsSuccess = false
    @State private var busy = false
    @State private var pix: WebAPI.PixResponse?
    @State private var watching: UUID?

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
                Text("Ao gerar o Pix, você concorda com os Termos de Uso.")
                    .font(.footnote)
                    .foregroundStyle(Brand.inkMuted)
                if let pix, let code = pix.pix?.copyPaste, !code.isEmpty {
                    Text("Valor \(Money.format(cents: pix.amountCents ?? 0))")
                        .font(.headline)
                    if let image = PixCodeImage.make(code) {
                        Image(uiImage: image)
                            .interpolation(.none)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: 240)
                            .accessibilityLabel("QR Code do Pix")
                    }
                    Button("Copiar código Pix") {
                        UIPasteboard.general.string = code
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                if let message {
                    Text(message).foregroundStyle(messageIsSuccess ? Brand.success : Brand.danger)
                }
                if pix == nil {
                    Button(busy ? "Criando…" : "Criar aporte") {
                        Task { await submit() }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(busy)
                }
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
            .task(id: watching) { await watch() }
        }
    }

    private func submit() async {
        guard let userId = session.profile?.id else { return }
        if session.profile?.identityComplete != true {
            message = "Complete seu cadastro antes de fazer um aporte."
            messageIsSuccess = false
            return
        }
        guard let cents = Money.cents(from: amount), cents >= LegalCopy.minimumContributionCents || cents == reservation.remainingCents else {
            message = "Valor mínimo de R$ 5,00 por aporte."
            messageIsSuccess = false
            return
        }
        busy = true
        defer { busy = false }
        do {
            // A produção (src/lib/pix/generate.ts) ainda exige contractId; o aceite é registrado
            // automaticamente, sem tela, enquanto o contrato migra para os Termos de Uso.
            let contractId = try await Repository.acceptAporteContract(userId: userId, reservationId: reservation.id)
            let generated = try await Repository.createContribution(
                reservationId: reservation.id,
                amountCents: cents,
                contractId: contractId
            )
            pix = generated
            watching = generated.contributionId
            if generated.pix?.copyPaste == nil {
                message = generated.error ?? "O Pix foi registrado, mas o código ainda não está disponível."
                messageIsSuccess = false
            } else {
                message = nil
            }
        } catch {
            message = describeError(error)
            messageIsSuccess = false
        }
    }

    private func watch() async {
        guard let watching else { return }
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            guard let rows = try? await Repository.contributions(reservationId: reservation.id) else { continue }
            if rows.contains(where: { $0.id == watching && $0.status == "confirmed" }) {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                message = "Aporte confirmado."
                messageIsSuccess = true
                return
            }
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
    @State private var feePercent = WithdrawalFee.defaultPercent
    @State private var aportes: [WithdrawalFee.Aporte] = []
    @State private var loadingBreakdown = true

    private let types = ["cpf", "cnpj", "email", "phone", "random"]

    private var breakdown: WithdrawalBreakdown {
        WithdrawalFee.breakdown(aportes: aportes, requestedAt: Date(), feePercent: feePercent)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(LegalCopy.withdrawalRule(feePercent: feePercent))
                        .font(.footnote)
                    if loadingBreakdown {
                        LoadingSkeleton(lines: 4)
                    } else {
                        breakdownRows
                    }
                }
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
            .task { await loadBreakdown() }
            .onAppear {
                holder = session.profile?.fullName ?? ""
                cpf = session.profile?.cpf ?? ""
                pixKey = session.profile?.pixKey ?? ""
                pixType = session.profile?.pixKeyType ?? "cpf"
            }
        }
    }

    @ViewBuilder
    private var breakdownRows: some View {
        let b = breakdown
        let pct = WithdrawalFee.percentLabel(b.feePercent)
        row("Aportes confirmados", Money.format(cents: b.totalCents))
        row("Reembolso integral (últimos 7 dias)", Money.format(cents: b.fullRefundCents))
        row("Com taxa (há mais de 7 dias)", Money.format(cents: b.discountedCents))
        row("Taxa administrativa (\(pct)%)", "− \(Money.format(cents: b.feeCents))", tint: Brand.danger)
        HStack {
            Text("Você receberá").fontWeight(.semibold)
            Spacer()
            Text(Money.format(cents: b.netCents)).font(.headline).foregroundStyle(Brand.accent)
        }
        Text("Estimativa. O valor final é calculado pelo servidor na data do pedido.")
            .font(.caption)
            .foregroundStyle(Brand.inkMuted)
    }

    private func row(_ title: String, _ value: String, tint: Color = Brand.ink) -> some View {
        HStack {
            Text(title).foregroundStyle(Brand.inkMuted)
            Spacer()
            Text(value).fontWeight(.semibold).foregroundStyle(tint)
        }
        .font(.subheadline)
    }

    private func loadBreakdown() async {
        defer { loadingBreakdown = false }
        async let pct = Repository.withdrawalFeePercent()
        let rows = (try? await Repository.contributions(reservationId: reservation.id)) ?? []
        aportes = rows
            .filter { $0.status == "confirmed" && $0.paymentMethod.lowercased().contains("pix") }
            .compactMap { c in
                guard let at = c.confirmedAt ?? c.createdAt else { return nil }
                return WithdrawalFee.Aporte(amountCents: c.amountCents, confirmedAt: at)
            }
        feePercent = await pct
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
    @State private var queued: [WebAPI.TradeInDevice] = []

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
                if !queued.isEmpty {
                    Text("\(queued.count) de 5 aparelhos nesta avaliação")
                }
                if let message {
                    Text(message).foregroundStyle(Brand.danger)
                }
                Button("Adicionar aparelho") { addDevice() }
                    .disabled(queued.count >= 5)
                Button(busy ? "Enviando…" : "Enviar avaliação") {
                    Task { await submit() }
                }
                .disabled(busy || (queued.isEmpty && model.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty))
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

    private func currentDevice() -> WebAPI.TradeInDevice? {
        let trimmedModel = model.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedImei = imei.filter { !$0.isWhitespace }
        guard !trimmedModel.isEmpty, !trimmedImei.isEmpty else {
            message = "Preencha modelo e IMEI."
            return nil
        }
        guard let expectedCents = Money.cents(from: expected), let minimumCents = Money.cents(from: minimum),
              expectedCents > 0, minimumCents > 0 else {
            message = "Informe valores esperado e mínimo válidos."
            return nil
        }
        guard minimumCents <= expectedCents else {
            message = "O valor mínimo não pode ser maior que o esperado."
            return nil
        }
        guard !maintenance.isEmpty else {
            message = "Selecione ao menos uma opção de manutenção."
            return nil
        }
        let batteryValue = Int(battery)
        let reason = batteryReason.isEmpty ? nil : batteryReason
        if reason == nil {
            guard let batteryValue, (0...100).contains(batteryValue) else {
                message = "Informe a saúde da bateria entre 0 e 100, ou escolha que não sabe."
                return nil
            }
        }
        guard !photos.isEmpty else {
            message = "Envie ao menos uma foto do aparelho."
            return nil
        }
        _ = batteryValue
        return WebAPI.TradeInDevice(
            deviceModel: trimmedModel,
            imei: trimmedImei,
            expectedBrl: expected.trimmingCharacters(in: .whitespacesAndNewlines),
            minimumBrl: minimum.trimmingCharacters(in: .whitespacesAndNewlines),
            maintenanceOptions: Array(maintenance),
            liquidExposure: liquid,
            batteryHealthPct: reason == nil ? battery : "",
            batteryHealthReason: reason,
            photos: photos
        )
    }

    private func addDevice() {
        guard queued.count < 5 else {
            message = "A avaliação aceita até 5 aparelhos."
            return
        }
        guard let device = currentDevice() else { return }
        queued.append(device)
        model = ""
        imei = ""
        expected = ""
        minimum = ""
        liquid = false
        battery = ""
        batteryReason = ""
        maintenance = []
        photos = []
        picker = []
        message = "Aparelho adicionado. Envie a avaliação ou inclua outro."
    }

    private func submit() async {
        var devices = queued
        if !model.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || devices.isEmpty {
            guard let device = currentDevice() else { return }
            devices.append(device)
        }
        guard !devices.isEmpty, devices.count <= 5 else {
            message = "A avaliação aceita até 5 aparelhos."
            return
        }
        busy = true
        defer { busy = false }
        do {
            try await Repository.submitTradeIn(reservationId: reservationID, devices: devices)
            onDone()
        } catch {
            message = describeError(error)
        }
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
