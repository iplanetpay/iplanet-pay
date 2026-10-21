import Foundation
import IPlanetCore

enum LegalCopy {
    static let termsVersion = "platform-v4"
    static let aporteContractVersion = "aporte-v1"
    static let minimumContributionCents = 500

    /// Texto do card de bônus no site (referral-bonus-card.tsx).
    static let referralBonusWithdrawalNote = "Prefere sacar? O bônus só sai via Pix com aprovação do admin."

    static let cancelWithAportesNote = "Cancelar com aportes segue a cláusula 11 dos Termos: aportes confirmados há 7 dias ou menos voltam integralmente; sobre os confirmados há mais de 7 dias é descontada a taxa administrativa."

    static let pixPayoutNote = "O Pix do reembolso é efetuado em até 24h após a aprovação no Financeiro."

    /// Introdução de withdrawal-fee-breakdown.tsx (markdown inline).
    static func withdrawalRule(feePercent: Double, windowDays: Int, settled: Bool = false) -> String {
        "Aportes confirmados há \(windowDays) dias ou menos voltam **integralmente**. Sobre os confirmados há mais de \(windowDays) dias \(settled ? "foi" : "será") descontada a **taxa administrativa de \(WithdrawalFee.percentLabel(feePercent))%**."
    }

    static func bonusWithdrawalNote(cents: Int) -> String {
        "Bônus de indicação de \(Money.format(cents: cents)), sem taxa. O saque do bônus só sai com aprovação do admin na tela Saques; o valor fica retido até a análise e volta para você se o pedido for rejeitado."
    }

    /// Termos exatos de docs/termos-de-uso.md.
    static var terms: String { TermsOfUse.markdown }

    /// Markdown renderizado: títulos viram negrito, ênfases inline preservadas.
    static let termsAttributed: AttributedString = {
        let lines = TermsOfUse.markdown.split(separator: "\n", omittingEmptySubsequences: false).map { line -> String in
            if let r = line.range(of: #"^#{1,6}\s+"#, options: .regularExpression) { return "**" + line[r.upperBound...] + "**" }
            if line.trimmingCharacters(in: .whitespaces) == "---" { return "" }
            return String(line)
        }
        let text = lines.joined(separator: "\n")
        return (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text)
    }()

    static let aporteContract = """
    CONTRATO DE APORTE — iPLANET PAY
    Versão \(aporteContractVersion)

    Este texto é um modelo genérico. Ele será substituído pelo contrato definitivo enviado pela iPlanet.

    1. Partes
    Você, usuário cadastrado na plataforma iPlanet Pay, declara que inicia um aporte voluntário vinculado a uma reserva de produto Apple. A iPlanet Pay registra o valor, a reserva e a forma de pagamento escolhida (Pix).

    2. Objeto
    O aporte é um pagamento parcial ou total do preço de lista da reserva. Ele não transfere a posse do aparelho antes da quitação e da retirada ou envio, conforme as regras vigentes da plataforma.

    3. Valor e Pix
    O valor informado na tela é o valor deste aporte. O código Pix gerado em seguida vale para este lançamento. Aporte confirmado é aquele reconhecido pelo sistema após a compensação. Valor mínimo, saldo restante e status da reserva aparecem na mesma tela em que este contrato é aceito.

    4. Leitura
    O botão de aceite só é habilitado depois que esta tela é rolada até o fim. Ao marcar a caixa e continuar, você declara que leu este instrumento até o final e que concorda com o aporte.

    5. Registro da aceitação
    Para evidência da assinatura eletrônica deste aporte, a plataforma grava, junto com o texto aceito:
    - data e hora do aceite;
    - identificador do aparelho (user agent) e idioma;
    - sinais do aparelho (plataforma e um resumo técnico do dispositivo).

    Esses dados ficam associados a você, à reserva e, quando o aporte é criado, ao lançamento correspondente. Não use este fluxo se não concordar com esse registro.

    6. Cancelamento e saque
    Regras de cancelamento, reembolso, taxa e retirada continuam as publicadas nos Termos de Uso da plataforma. Este aceite não altera sozinho essas regras; ele confirma o aporte específico que você está iniciando.

    7. Declaração
    Você confirma que os dados da conta são seus, que o valor parte de decisão sua e que leu este contrato até o fim antes de aceitar.

    iPlanet Pay — instrumento genérico de aporte, sujeito à versão final do contrato.
    """

    static let raffleEligibility = "Apenas será considerado a participação do sorteio caso esteja concluído 30% do valor de aportes."

    static let pixServerNote = "O QR Code Pix é emitido pelo servidor (Mercado Pago). O app cria o aporte pendente e mostra o código quando ele já estiver gravado. A compensação continua no mesmo Supabase da versão web."
}
