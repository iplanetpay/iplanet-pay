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
    @State private var aportePrefillCents: Int?
    @State private var showTradeIn = false
    @State private var showWithdraw = false
    @State private var showSwitch = false
    @State private var showSimulator = false
    @State private var showPickup = false
    @State private var goals: [PaymentGoal] = []
    @State private var cancelStep: CancelConfirm.Step = .idle

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
        .alert(CancelConfirm.warnTitle, isPresented: cancelAlertBinding(.warn)) {
            Button(CancelConfirm.keep, role: .cancel) { cancelStep = CancelConfirm.next(cancelStep, .dismiss) }
            Button(CancelConfirm.continueLabel, role: .destructive) {
                cancelStep = CancelConfirm.next(cancelStep, .continue)
            }
        } message: {
            if let paid = reservation?.amountPaidCents, paid > 0 {
                Text("\(Money.format(cents: paid)) em aportes voltam para a carteira. \(CancelConfirm.warnWithAportes)")
            } else {
                Text(CancelConfirm.warnNoAportes)
            }
        }
        .alert(CancelConfirm.finalTitle, isPresented: cancelAlertBinding(.final)) {
            Button(CancelConfirm.back, role: .cancel) { cancelStep = CancelConfirm.next(cancelStep, .dismiss) }
            Button(CancelConfirm.confirm, role: .destructive) {
                guard CancelConfirm.shouldSubmit(cancelStep, .confirm) else { return }
                cancelStep = CancelConfirm.next(cancelStep, .confirm)
                Task { await cancel() }
            }
        } message: {
            Text(CancelConfirm.finalBody)
        }
        .sheet(isPresented: $showAporte) {
            if let reservation {
                AporteSheet(reservation: reservation, prefillCents: aportePrefillCents) {
                    showAporte = false
                    aportePrefillCents = nil
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
        let credits = offers.map(\.credit)
        let trade = TradeInCredit.summary(credits)
        let cash = TradeInCredit.cashCents(amountPaidCents: reservation.amountPaidCents, offers: credits)
        let seg = TradeInCredit.segments(
            listPriceCents: reservation.listPriceCents, cashCents: cash, tradeCents: trade.activeCents
        )
        ProgressRing(percent: Double(seg.cashPct), caption: "Aportes", secondaryPercent: Double(seg.tradePct))
        Text("Total: \(Money.format(cents: reservation.listPriceCents))")
        (
            Text("Pago: \(Money.format(cents: cash))")
            + (trade.activeCents > 0
                ? Text(" + \(Money.format(cents: trade.activeCents))").foregroundColor(TradeInTone.yellow)
                : Text(""))
            + (trade.expiredCents > 0
                ? Text(" + \(Money.format(cents: trade.expiredCents))").foregroundColor(TradeInTone.expiredRed)
                : Text(""))
        )
            .font(.headline)
            .contentTransition(.numericText())
        Text("Restante: \(Money.format(cents: max(0, reservation.listPriceCents - cash - trade.activeCents)))")
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
            Button(cancelStep == .submitting ? CancelConfirm.submitting : "Cancelar reserva", role: .destructive) {
                cancelStep = CancelConfirm.next(cancelStep, .open)
            }
            .disabled(cancelStep == .submitting)
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
                        if contribution.status == "pending" {
                            SimulatePaidButton(contributionId: contribution.id) { error, ok in
                                guard ok else { info = error; return }
                                // O servidor já confirmou: avança sem depender de nova leitura.
                                Task {
                                    if !(await checkPendingNow()) {
                                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                                        info = "Aporte confirmado."
                                        await load()
                                        await session.refreshProfile()
                                    }
                                }
                            }
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
                        if offer.status == "approved", let credit = offer.approvedValueCents, !offer.credit.isDiscarded {
                            Text("Crédito aplicado: \(Money.format(cents: credit))")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Brand.accent)
                        }
                        if let days = TradeInCredit.daysRemaining(offer.credit), days > 0,
                           !offer.credit.isMarkedExpired, let expires = TradeInCredit.expiresAt(offer.credit) {
                            Text("Expira em \(days) \(days == 1 ? "dia" : "dias") · \(DatesPT.short(expires))")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(TradeInTone.chipText)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 4)
                                .background(TradeInTone.chipBackground, in: Capsule())
                        }
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
            if await checkPendingNow() { return }
        }
    }

    /// pending -> confirmed: atualiza reserva (saldo/meta/foguete) e perfil, como na confirmação real.
    @discardableResult
    private func checkPendingNow() async -> Bool {
        guard let fresh = try? await Repository.contributions(reservationId: reservationID) else { return false }
        let before = Dictionary(contributions.map { ($0.id, $0.status) }, uniquingKeysWith: { a, _ in a })
        let after = Dictionary(fresh.map { ($0.id, $0.status) }, uniquingKeysWith: { a, _ in a })
        contributions = fresh
        guard !PixConfirmation.newlyConfirmed(before: before, after: after).isEmpty else { return false }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        info = "Aporte confirmado."
        router.contributionsVersion += 1
        reservation = try? await Repository.reservation(id: reservationID)
        await session.refreshProfile()
        return true
    }

    private func openPixIfRequested(_ id: UUID?) {
        guard id == reservationID else { return }
        aportePrefillCents = router.requestPixAmountCents
        router.requestPixAmountCents = nil
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

    /// Binding de cada alerta da dupla confirmação; fechar pelo sistema conta como "dismiss".
    private func cancelAlertBinding(_ step: CancelConfirm.Step) -> Binding<Bool> {
        Binding(
            get: { cancelStep == step },
            set: { shown in
                if !shown, cancelStep == step { cancelStep = CancelConfirm.next(cancelStep, .dismiss) }
            })
    }

    private func cancel() async {
        do {
            try await Repository.cancelReservation(id: reservationID)
            cancelStep = CancelConfirm.next(cancelStep, .done)
            info = "Reserva cancelada."
            await load()
        } catch {
            cancelStep = CancelConfirm.next(cancelStep, .failed)
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
    var prefillCents: Int? = nil
    var onDone: () -> Void
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router
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
                    if let id = pix.contributionId, message != "Aporte confirmado." {
                        SimulatePaidButton(contributionId: id) { error, ok in
                            guard ok else { message = error; messageIsSuccess = false; return }
                            Task { await simulatedPaid() }
                        }
                    }
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
            .onAppear {
                if amount.isEmpty, let text = GoalAporte.amountText(
                    prefillCents: prefillCents,
                    remainingCents: reservation.remainingCents
                ) {
                    amount = text
                }
            }
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
            if await checkNow() { return }
        }
    }

    /// "Pago (teste)": o servidor respondeu ok, então o aporte está confirmado. Um toque basta:
    /// mostra o sucesso e fecha a folha (a reserva recarrega no onDone), sem precisar do "Fechar".
    private func simulatedPaid() async {
        if message != "Aporte confirmado." {
            watching = nil
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            message = "Aporte confirmado."
            messageIsSuccess = true
            router.contributionsVersion += 1
            await session.refreshProfile()
        }
        try? await Task.sleep(for: .seconds(PixConfirmation.simulatedAutoCloseSeconds))
        onDone()
    }

    /// Mesmo fluxo da detecção automática: pending -> confirmed dispara o sucesso.
    @discardableResult
    private func checkNow() async -> Bool {
        guard let watching, message != "Aporte confirmado." else { return false }
        guard let rows = try? await Repository.contributions(reservationId: reservation.id) else { return false }
        let current = rows.first { $0.id == watching }?.status
        guard PixConfirmation.triggersSuccess(previous: "pending", current: current) else { return false }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        message = "Aporte confirmado."
        messageIsSuccess = true
        router.contributionsVersion += 1
        await session.refreshProfile()
        return true
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

/// Espelha request-saque-button.tsx do site: saque da reserva (com quebra) ou do bônus de indicação.
struct WithdrawalSheet: View {
    enum Mode { case reserva(ReservationRow), bonus(Int) }

    let mode: Mode
    var onDone: () -> Void
    @Environment(SessionStore.self) private var session
    @State private var pixKey = ""
    @State private var pixType = "cpf"
    @State private var holder = ""
    @State private var cpf = ""
    @State private var message: String?
    @State private var busy = false
    @State private var split: WithdrawalBreakdown?
    @State private var splitError: String?
    @State private var created: WithdrawalRequest?
    @State private var sent = false

    init(reservation: ReservationRow, onDone: @escaping () -> Void) {
        self.mode = .reserva(reservation)
        self.onDone = onDone
    }

    init(bonusCents: Int, onDone: @escaping () -> Void) {
        self.mode = .bonus(bonusCents)
        self.onDone = onDone
    }

    private let types = ["cpf", "cnpj", "email", "phone", "random"]
    private var isBonus: Bool { if case .bonus = mode { true } else { false } }
    private var cpfDigits: String { cpf.filter(\.isNumber) }
    private var canSubmit: Bool {
        !busy && !pixKey.trimmingCharacters(in: .whitespaces).isEmpty
            && !holder.trimmingCharacters(in: .whitespaces).isEmpty && cpfDigits.count == 11
    }

    var body: some View {
        NavigationStack {
            Form {
                if sent {
                    sentSection
                } else {
                    Section {
                        switch mode {
                        case .bonus(let cents):
                            Text(LegalCopy.bonusWithdrawalNote(cents: cents)).font(.footnote)
                        case .reserva:
                            if let split {
                                breakdownRows(split, settled: false)
                            } else if let splitError {
                                Text(splitError).foregroundStyle(Brand.danger)
                            } else {
                                Text("Calculando o valor do saque…").foregroundStyle(Brand.inkMuted)
                                LoadingSkeleton(lines: 4)
                            }
                        }
                        Text(LegalCopy.pixPayoutNote).font(.caption).foregroundStyle(Brand.inkMuted)
                    }
                    Section {
                        Picker("Tipo da chave Pix", selection: $pixType) {
                            ForEach(types, id: \.self) { Text($0).tag($0) }
                        }
                        TextField("Chave Pix", text: $pixKey)
                        TextField("Nome completo do titular", text: $holder, prompt: Text("Nome como no banco"))
                        TextField("CPF do titular", text: $cpf).keyboardType(.numberPad)
                    }
                    if let message {
                        Text(message).foregroundStyle(Brand.danger)
                    }
                    Button(busy ? "Enviando..." : "Confirmar saque") {
                        Task { await submit() }
                    }
                    .disabled(!canSubmit)
                }
            }
            .navigationTitle(isBonus ? "Sacar bônus de indicação" : "Solicitar saque")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { onDone() }
                }
            }
            .task { await loadSplit() }
            .onAppear {
                holder = session.profile?.fullName ?? ""
                cpf = session.profile?.cpf ?? ""
                pixKey = session.profile?.pixKey ?? ""
                pixType = session.profile?.pixKeyType ?? "cpf"
            }
        }
    }

    @ViewBuilder
    private var sentSection: some View {
        Section {
            Text("Pedido de saque enviado. Status: \(created?.statusLabel ?? "Pendente").")
                .fontWeight(.semibold)
            if let created {
                if created.source == "bonus" || isBonus {
                    row("Você receberá", Money.format(cents: created.refundAmountCents))
                } else {
                    breakdownRows(created.breakdown, settled: false)
                }
            }
            Text(isBonus ? "O saque do bônus só sai com aprovação do admin na tela Saques." : LegalCopy.pixPayoutNote)
                .font(.caption).foregroundStyle(Brand.inkMuted)
        }
        Button("Fechar") { onDone() }
    }

    /// withdrawal-fee-breakdown.tsx
    @ViewBuilder
    private func breakdownRows(_ b: WithdrawalBreakdown, settled: Bool) -> some View {
        let pct = WithdrawalFee.percentLabel(b.feePct)
        Text((try? AttributedString(markdown: LegalCopy.withdrawalRule(feePercent: b.feePct, windowDays: b.windowDays, settled: settled)))
             ?? AttributedString(LegalCopy.withdrawalRule(feePercent: b.feePct, windowDays: b.windowDays, settled: settled)))
            .font(.footnote)
        row("Aportes confirmados", Money.format(cents: b.totalCents))
        row("Reembolso integral (até \(b.windowDays) dias)", Money.format(cents: b.fullRefundCents))
        row("Com desconto (há mais de \(b.windowDays) dias)", Money.format(cents: b.discountedCents))
        row("Taxa administrativa (\(pct)% da parte com desconto)", "− \(Money.format(cents: b.feeCents))", tint: Brand.danger)
        HStack {
            Text(settled ? "Você recebeu" : "Você receberá").fontWeight(.semibold)
            Spacer()
            Text(Money.format(cents: b.netCents)).font(.headline).foregroundStyle(Brand.accent)
        }
    }

    private func row(_ title: String, _ value: String, tint: Color = Brand.ink) -> some View {
        HStack {
            Text(title).foregroundStyle(Brand.inkMuted)
            Spacer()
            Text(value).fontWeight(.semibold).foregroundStyle(tint)
        }
        .font(.subheadline)
    }

    private func loadSplit() async {
        guard case .reserva(let reservation) = mode else { return }
        do {
            split = try await Repository.withdrawalPreview(reservationId: reservation.id)
        } catch {
            splitError = "Não foi possível calcular o saque."
        }
    }

    private func submit() async {
        let key = pixKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = holder.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty, !name.isEmpty, cpfDigits.count == 11 else {
            message = "Preencha a chave Pix, o tipo, o titular e o CPF."
            return
        }
        busy = true
        message = nil
        defer { busy = false }
        do {
            switch mode {
            case .reserva(let reservation):
                created = try await Repository.requestWithdrawal(
                    RPC.Withdrawal(pReservationId: reservation.id, pPixKey: key, pPixKeyType: pixType,
                                   pHolderFullName: name, pHolderCpf: cpfDigits)
                )
            case .bonus:
                created = try await Repository.requestBonusWithdrawalRow(
                    pixKey: key, pixKeyType: pixType, holderFullName: name, holderCpf: cpfDigits)
                await session.refreshProfile()
            }
            sent = true
        } catch is URLError {
            message = "Erro de rede. Tente novamente."
        } catch {
            let text = describeError(error)
            message = text.isEmpty ? "Não foi possível solicitar o saque." : text
        }
    }
}

/// Card "Bônus de indicação" do site (referral-bonus-card.tsx) com a ação "Sacar bônus".
struct ReferralBonusCard: View {
    let bonusCents: Int
    var hasActiveReservation: Bool
    @State private var showWithdraw = false

    var body: some View {
        BrandCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Bônus de indicação").font(.headline)
                Text("Você tem \(Money.format(cents: bonusCents)) para direcionar a um aporte ativo.")
                    .font(.subheadline)
                if !hasActiveReservation {
                    Text("Crie uma reserva ativa para usar o bônus.")
                        .font(.footnote).foregroundStyle(Brand.inkMuted)
                }
                Text(LegalCopy.referralBonusWithdrawalNote)
                    .font(.footnote).foregroundStyle(Brand.inkMuted)
                Button("Sacar bônus") { showWithdraw = true }
                    .buttonStyle(SecondaryButtonStyle())
            }
        }
        .sheet(isPresented: $showWithdraw) {
            WithdrawalSheet(bonusCents: bonusCents) { showWithdraw = false }
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

/// Botão "Pago (teste)": aparece em DEBUG ou quando o servidor informa simulação ligada
/// (ALLOW_PAYMENT_SIMULATION, desligado ao entrar chave de produção do Mercado Pago). Pede ao servidor para simular o pagamento;
/// a confirmação chega pelo mesmo fluxo da detecção automática do Pix.
struct SimulatePaidButton: View {
    let contributionId: UUID
    var onResult: (String?, Bool) -> Void
    @State private var busy = false
    @State private var visible = PaymentSimulation.forcedVisible

    var body: some View {
        Group {
            if visible { button }
        }
        .task {
            if !visible { visible = await PaymentSimulation.serverEnabled() }
        }
    }

    private var button: some View {
        Button {
            Task { await run() }
        } label: {
            HStack(spacing: 8) {
                Text(busy ? "Simulando…" : "Pago (teste)")
                Text("Somente teste")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.orange.opacity(0.2))
                    .foregroundStyle(Color.orange)
                    .clipShape(Capsule())
            }
        }
        .buttonStyle(SecondaryButtonStyle())
        .disabled(busy)
        .accessibilityHint("Simula o pagamento do Pix. Disponível apenas em builds de teste.")
    }

    private func run() async {
        busy = true
        defer { busy = false }
        do {
            switch try await WebAPI.simulatePayment(contributionId: contributionId) {
            case .ok: onResult(nil, true)
            case .disabled:
                PaymentSimulation.markDisabled()
                if !PaymentSimulation.forcedVisible { visible = false }
                onResult("Simulação desativada neste servidor.", false)
            }
        } catch {
            onResult(describeError(error), false)
        }
    }
}

/// Visibilidade do botão de simulação. Em DEBUG sempre; fora dele, só com o servidor ligado.
@MainActor
enum PaymentSimulation {
    #if DEBUG
    static let forcedVisible = true
    #else
    static let forcedVisible = false
    #endif
    private static var cached: Bool?

    static func serverEnabled() async -> Bool {
        if let cached { return cached }
        let enabled = await WebAPI.paymentSimulationEnabled()
        cached = enabled
        return enabled
    }

    static func markDisabled() { cached = false }
}

