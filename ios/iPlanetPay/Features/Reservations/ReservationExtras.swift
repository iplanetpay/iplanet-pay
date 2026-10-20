import CoreImage.CIFilterBuiltins
import IPlanetCore
import SwiftUI
import UIKit

enum PixCodeImage {
    static func make(_ payload: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(payload.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
        let context = CIContext()
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

struct ProgressRing: View {
    var percent: Double
    var caption: String
    var tint: Color = Brand.accent
    var size: CGFloat = 112

    var body: some View {
        ZStack {
            Circle()
                .stroke(Brand.line, lineWidth: 8)
            Circle()
                .trim(from: 0, to: max(0, min(1, percent / 100)))
                .stroke(tint, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text("\(Int(percent.rounded()))%")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Brand.ink)
                Text(caption)
                    .font(.caption)
                    .foregroundStyle(Brand.inkMuted)
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(caption), \(Int(percent.rounded())) por cento")
    }
}

struct RankingCard: View {
    let reservation: ReservationRow
    @Environment(AppRouter.self) private var router

    var body: some View {
        let eligible = RaffleRules.reservationEligible(
            contributedCents: reservation.amountPaidCents,
            listPriceCents: reservation.listPriceCents
        )
        let tickets = eligible ? RaffleRules.tickets(fromCents: reservation.amountPaidCents) : 0
        let gap = RaffleRules.eligibilityGapCents(
            contributedCents: reservation.amountPaidCents,
            listPriceCents: reservation.listPriceCents
        )
        let pct = reservation.listPriceCents > 0
            ? (Double(reservation.amountPaidCents) / Double(reservation.listPriceCents) * 1000).rounded(.down) / 10
            : 0
        BrandCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Ranking").font(.title3.weight(.bold))
                    Spacer()
                    StatusPill(
                        text: eligible ? "Participando do sorteio" : "Fora do sorteio",
                        tone: eligible ? .accent : .lavender
                    )
                }
                Text("Aportado nesta reserva: \(pctText(pct))% (mínimo \(RaffleRules.minProgressPct)%)")
                    .foregroundStyle(Brand.inkMuted)
                Text("Suas fichas: \(tickets)")
                    .foregroundStyle(Brand.inkMuted)
                if !eligible && gap > 0 {
                    Text("Faltam \(Money.format(cents: gap)) em aportes para participar.")
                        .foregroundStyle(Brand.inkMuted)
                }
                Text(RaffleRules.eligibilityMessage)
                    .font(.subheadline)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Brand.backgroundSubtle)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                Button("Ver ranking") { router.overlay = .ranking }
                    .frame(minHeight: 44)
            }
        }
    }

    private func pctText(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 1
        return formatter.string(from: NSNumber(value: value)) ?? "0"
    }
}

struct ReservationGoalCard: View {
    let goal: PaymentGoal
    let reservation: ReservationRow
    let contributions: [Contribution]
    @Environment(AppRouter.self) private var router

    var body: some View {
        let snapshot = GoalSnapshot.make(goal: goal, reservation: reservation, contributions: contributions)
        BrandCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Meta").font(.title3.weight(.bold))
                Text(goal.name).font(.headline)
                StatusPill(text: snapshot.status.label, tone: snapshot.tone)
                Text(snapshot.status.message)
                    .font(.subheadline)
                    .foregroundStyle(Brand.inkMuted)
                Text("\(Money.format(cents: snapshot.savedCents)) de \(Money.format(cents: snapshot.targetCents))")
                Button("Ver meta") {
                    router.goalID = goal.id
                    router.selectedTab = .goals
                }
                .frame(minHeight: 44)
            }
        }
    }
}

struct PickupSheet: View {
    let reservation: ReservationRow
    var onDone: () -> Void
    @Environment(SessionStore.self) private var session
    @State private var step = "mode"
    @State private var mode = "store"
    @State private var shipping = "sedex"
    @State private var street = ""
    @State private var number = ""
    @State private var city = ""
    @State private var state = "SP"
    @State private var zip = ""
    @State private var loan = false
    @State private var message: String?
    @State private var busy = false

    private let methods: [(id: String, label: String, freight: Int, insurance: Int)] = [
        ("sedex", "SEDEX", 4500, 1200),
        ("pac", "PAC", 2800, 900),
        ("motoboy", "Motoboy (capital)", 3500, 800),
    ]

    private var percent: Int {
        guard reservation.listPriceCents > 0 else { return 0 }
        return Int((Double(reservation.amountPaidCents) / Double(reservation.listPriceCents) * 100).rounded(.down))
    }

    private var needsLoan: Bool { percent >= 70 && percent < 100 }

    private var selectedMethod: (id: String, label: String, freight: Int, insurance: Int) {
        methods.first { $0.id == shipping } ?? methods[0]
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Solicitar retirada")
                        .font(.title2.weight(.bold))
                    if step == "mode" {
                        Text("Escolha como deseja receber o aparelho.")
                            .foregroundStyle(Brand.inkMuted)
                        Button("Retirar na loja") { choose("store") }
                            .buttonStyle(SecondaryButtonStyle())
                        Text(reservation.store?.name ?? "Loja")
                            .font(.caption)
                            .foregroundStyle(Brand.inkMuted)
                        Button("Enviar para mim") { choose("shipping") }
                            .buttonStyle(SecondaryButtonStyle())
                        Text("SEDEX, PAC ou Motoboy")
                            .font(.caption)
                            .foregroundStyle(Brand.inkMuted)
                    }
                    if step == "loan" {
                        Text("Entrega antecipada (\(percent)%): você assina contrato de empréstimo do aparelho até quitar 100% dos aportes.")
                            .foregroundStyle(Brand.inkMuted)
                        Toggle("Li e aceito o contrato de empréstimo até conclusão dos pagamentos.", isOn: $loan)
                        Button(mode == "store" ? (busy ? "Enviando…" : "Confirmar retirada na loja") : "Continuar para endereço") {
                            if mode == "store" {
                                Task { await submitStore() }
                            } else {
                                step = "shipping"
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(!loan || busy)
                    }
                    if step == "shipping" {
                        Picker("Forma de envio", selection: $shipping) {
                            ForEach(methods, id: \.id) { method in
                                Text("\(method.label) — \(Money.format(cents: method.freight + method.insurance))").tag(method.id)
                            }
                        }
                        field("Rua", text: $street)
                        field("Número", text: $number)
                        field("Cidade", text: $city)
                        field("UF", text: $state)
                        field("CEP", text: $zip)
                        Button("Revisar frete") { step = "freight" }
                            .buttonStyle(PrimaryButtonStyle())
                    }
                    if step == "freight" {
                        Text("Frete: \(Money.format(cents: selectedMethod.freight))")
                        Text("Seguro: \(Money.format(cents: selectedMethod.insurance))")
                        Text("Total Pix: \(Money.format(cents: selectedMethod.freight + selectedMethod.insurance))")
                            .font(.headline)
                        Text("Ao confirmar, geramos Pix de frete + seguro vinculado à sua reserva.")
                            .font(.footnote)
                            .foregroundStyle(Brand.inkMuted)
                        Button(busy ? "Gerando…" : "Pagar frete via Pix") {
                            Task { await submitShipping() }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(busy)
                    }
                    if step == "done" {
                        Text("Solicitação registrada. Acompanhe o status nesta reserva.")
                            .foregroundStyle(Brand.inkMuted)
                    }
                    if let message {
                        Text(message).foregroundStyle(Brand.danger)
                    }
                }
                .padding(20)
            }
            .background(Brand.backgroundSubtle)
            .navigationTitle("Retirada")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { onDone() }
                }
            }
            .onAppear {
                street = session.profile?.address ?? ""
                number = session.profile?.addressNumber ?? ""
                city = session.profile?.city ?? ""
                state = session.profile?.state ?? "SP"
            }
        }
    }

    private func field(_ title: String, text: Binding<String>) -> some View {
        TextField(title, text: text)
            .padding(14)
            .background(Brand.background)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func choose(_ next: String) {
        mode = next
        if needsLoan {
            step = "loan"
        } else if next == "store" {
            Task { await submitStore() }
        } else {
            step = "shipping"
        }
    }

    private func submitStore() async {
        busy = true
        defer { busy = false }
        do {
            try await WebAPI.requestPickup(
                reservationId: reservation.id,
                body: WebAPI.PickupBody(
                    mode: "store",
                    shippingMethod: nil,
                    address: nil,
                    freightCents: nil,
                    insuranceCents: nil,
                    loanContractSigned: needsLoan ? loan : true
                )
            )
            step = "done"
        } catch {
            message = describeError(error)
        }
    }

    private func submitShipping() async {
        busy = true
        defer { busy = false }
        do {
            try await WebAPI.requestPickup(
                reservationId: reservation.id,
                body: WebAPI.PickupBody(
                    mode: "shipping",
                    shippingMethod: shipping,
                    address: WebAPI.PickupAddress(
                        street: street.trimmingCharacters(in: .whitespacesAndNewlines),
                        number: number.trimmingCharacters(in: .whitespacesAndNewlines),
                        city: city.trimmingCharacters(in: .whitespacesAndNewlines),
                        state: state.trimmingCharacters(in: .whitespacesAndNewlines),
                        zip: zip.trimmingCharacters(in: .whitespacesAndNewlines)
                    ),
                    freightCents: selectedMethod.freight,
                    insuranceCents: selectedMethod.insurance,
                    loanContractSigned: needsLoan ? loan : true
                )
            )
            step = "done"
        } catch {
            message = describeError(error)
        }
    }
}
