import Foundation
import IPlanetCore

enum LegalCopy {
    static let termsVersion = "platform-v4"
    static let aporteContractVersion = "aporte-v1"
    static let minimumContributionCents = 500

    static let referralBonusWithdrawalNote = "O saque do bônus de indicação depende de aprovação do administrador."

    static let cancelWithAportesNote = "Cancelar com aportes segue a política de saque: aportes Pix dos últimos 7 dias voltam integralmente; nos demais incide a taxa administrativa."

    static func withdrawalRule(feePercent: Double) -> String {
        "Aportes Pix confirmados nos últimos 7 dias voltam integralmente. Sobre os confirmados há mais de 7 dias incide taxa administrativa de \(WithdrawalFee.percentLabel(feePercent))%."
    }

    static let terms = """
    TERMOS DE USO — iPlanet Pay (versão platform-v4)

    1. Aportes e reserva
    Ao reservar um produto e realizar aportes via Pix, você concorda com as regras da plataforma iPlanet Pay.

    2. Política de saque (reembolso de aportes)
    Saques liberados após 15 dias de conta ativa e apenas quando os aportes confirmados na reserva superarem R$ 1.000,00.
    • Aportes Pix confirmados nos últimos 7 dias antes do pedido são reembolsados integralmente.
    • Sobre os aportes confirmados há mais de 7 dias, a plataforma retém uma taxa administrativa (padrão 30%, definida pela plataforma).
    • A mesma taxa vale para saque da reserva e da carteira, e o pedido mostra o detalhamento: parte integral, parte com desconto, taxa e valor líquido.
    Bônus de indicação não aplicados e valores não confirmados não entram na base de saque.

    3. Retirada do aparelho
    Com 100% quitado, você pode solicitar retirada na loja ou envio (frete + seguro via Pix).
    Com 70% ou mais, a entrega antecipada exige assinatura de contrato de empréstimo do aparelho até quitação total.

    4. Indicações
    O indicado deve aportar no mínimo R$ 100,00 confirmados para liberar o bônus ao indicador, que poderá direcionar o valor a uma reserva ativa. O saque do bônus de indicação depende de aprovação do administrador.

    5. Fichas e sorteio
    A cada R$ 100,00 em aportes confirmados você recebe 1 ficha para o sorteio mensal (dia 1). Mais fichas aumentam suas chances de liberação antecipada do aparelho. Só entram fichas de reservas com pelo menos 30% aportados.

    6. Prazo de reembolso Pix
    Após aprovação do saque pelo Financeiro, o Pix é efetuado em até 24 horas úteis (estimativa).

    7. Aceite
    Ao criar conta e marcar os aceites, você declara ter lido estes termos, política de saque, regras de retirada, indicação e sorteio.
    """

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
