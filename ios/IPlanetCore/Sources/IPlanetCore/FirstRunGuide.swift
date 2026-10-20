import Foundation

/// Etapas do guia do primeiro acesso, até o primeiro aporte confirmado.
public enum GuideStep: Int, Sendable, CaseIterable, Comparable {
    case chooseProduct, createReservation, createGoal, generatePix, confirmPayment, done

    public static func < (a: GuideStep, b: GuideStep) -> Bool { a.rawValue < b.rawValue }

    /// Etapas visíveis (sem `done`) para a barra de progresso.
    public static let visible: [GuideStep] = [.chooseProduct, .createReservation, .createGoal, .generatePix, .confirmPayment]

    public var number: Int { rawValue + 1 }

    public var title: String {
        switch self {
        case .chooseProduct: "Escolha seu primeiro produto"
        case .createReservation: "Reserve o aparelho"
        case .createGoal: "Crie uma meta (opcional)"
        case .generatePix: "Gere o aporte Pix"
        case .confirmPayment: "Pague o Pix"
        case .done: "Primeiro aporte feito!"
        }
    }

    public var message: String {
        switch self {
        case .chooseProduct: "No Catálogo, toque no iPhone que você quer conquistar."
        case .createReservation: "Na tela do produto, toque em reservar para garantir o seu aparelho."
        case .createGoal: "Na reserva, abra o Simulador de aportes para planejar valores e datas. Se preferir, pule esta etapa."
        case .generatePix: "Na reserva, toque em \"Gerar aporte Pix\", escolha o valor e copie o código."
        case .confirmPayment: "Pague o Pix no app do seu banco. Assim que confirmarmos, o guia termina."
        case .done: "Pronto! Seu primeiro aporte foi confirmado. Continue no seu ritmo."
        }
    }
}

public struct GuideFacts: Equatable, Sendable {
    public var hasReservation: Bool
    public var hasGoal: Bool
    public var goalSkipped: Bool
    public var hasPendingPix: Bool
    public var hasConfirmedContribution: Bool
    public var viewedProduct: Bool

    public init(hasReservation: Bool = false, hasGoal: Bool = false, goalSkipped: Bool = false,
                hasPendingPix: Bool = false, hasConfirmedContribution: Bool = false, viewedProduct: Bool = false) {
        self.hasReservation = hasReservation
        self.hasGoal = hasGoal
        self.goalSkipped = goalSkipped
        self.hasPendingPix = hasPendingPix
        self.hasConfirmedContribution = hasConfirmedContribution
        self.viewedProduct = viewedProduct
    }
}

public enum FirstRunGuide {
    /// Etapa atual a partir dos dados reais (retomável: sempre recalculada).
    public static func step(_ f: GuideFacts) -> GuideStep {
        if f.hasConfirmedContribution { return .done }
        if f.hasPendingPix { return .confirmPayment }
        if f.hasReservation { return (f.hasGoal || f.goalSkipped) ? .generatePix : .createGoal }
        return f.viewedProduct ? .createReservation : .chooseProduct
    }

    /// O guia aparece no primeiro acesso: sem nenhum aporte confirmado e não dispensado/concluído.
    public static func shouldShow(facts: GuideFacts, dismissed: Bool, completed: Bool) -> Bool {
        !dismissed && !completed && !facts.hasConfirmedContribution
    }

    public static func progress(_ step: GuideStep) -> Double {
        Double(min(step.rawValue, GuideStep.visible.count)) / Double(GuideStep.visible.count)
    }

    public static func defaultsKey(userId: String, _ name: String) -> String {
        "iplanet.guide.\(userId.lowercased()).\(name)"
    }
}
