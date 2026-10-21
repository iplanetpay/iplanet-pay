import type {
  PixKeyType,
  WithdrawalPayoutStatus,
  WithdrawalRequest,
  WithdrawalStatus,
} from "@/types/database";

export type {
  PixKeyType,
  WithdrawalPayoutStatus,
  WithdrawalRequest,
  WithdrawalStatus,
};

export const WITHDRAWAL_FEE_PCT_DEFAULT = 30;

export const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
};

export const PAYOUT_STATUS_LABEL: Record<WithdrawalPayoutStatus, string> = {
  pending_admin: "Aguardando admin",
  pending_gateway: "Aguardando gateway",
  queued: "Na fila",
  sent: "Enviado",
  failed: "Falhou",
};

export const PIX_KEY_TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Aleatória",
};

export const WITHDRAWAL_SELECT = `
  id,
  user_id,
  reservation_id,
  total_paid_cents,
  fee_percentage,
  fee_amount_cents,
  refund_amount_cents,
  pix_key,
  pix_key_type,
  holder_full_name,
  holder_cpf,
  status,
  payout_status,
  admin_notes,
  processed_at,
  processed_by,
  password_confirmed_at,
  created_at,
  updated_at
`;

export function calcWithdrawalAmounts(
  totalPaidCents: number,
  feePct = WITHDRAWAL_FEE_PCT_DEFAULT,
) {
  const fee = Math.round((totalPaidCents * feePct) / 100);
  const refund = totalPaidCents - fee;
  return { fee_amount_cents: fee, refund_amount_cents: refund, fee_percentage: feePct };
}

export const TERMS_VERSION = "platform-v3";

export const TERMS_OF_USE_PT = `
TERMOS DE USO — iPlanet Pay (versão platform-v3)

1. Aportes e reserva
Ao reservar um produto e realizar aportes via Pix, você concorda com as regras da plataforma iPlanet Pay.

2. Política de saque (reembolso de aportes)
Saques liberados após 15 dias de conta ativa e apenas quando os aportes confirmados na reserva superarem R$ 1.000,00.
Sobre o valor total dos aportes confirmados elegíveis:
• Você recebe 70% (reembolso líquido).
• A plataforma retém 30% a título de taxa administrativa.
Bônus de indicação não aplicados e valores não confirmados não entram na base de saque.

3. Retirada do aparelho
Com 100% quitado, você pode solicitar retirada na loja ou envio (frete + seguro via Pix).
Com 70% ou mais, a entrega antecipada exige assinatura de contrato de empréstimo do aparelho até quitação total.

4. Indicações
O indicado deve aportar no mínimo R$ 100,00 confirmados para liberar o bônus ao indicador, que poderá direcionar o valor a uma reserva ativa.

5. Fichas e sorteio
A cada R$ 100,00 em aportes confirmados você recebe 1 ficha para o sorteio mensal (dia 1). Mais fichas aumentam suas chances de liberação antecipada do aparelho.

6. Prazo de reembolso Pix
Após aprovação do saque pelo Financeiro, o Pix é efetuado em até 24 horas úteis (estimativa).

7. Contrato de aporte
Este contrato vale para todos os aportes feitos na plataforma; não é preciso aceitá-lo de novo a cada Pix.
7.1 Partes: você, usuário cadastrado na iPlanet Pay, faz aportes voluntários vinculados a uma reserva de produto. A iPlanet Pay registra o valor, a reserva e a forma de pagamento (Pix).
7.2 Objeto: cada aporte é um pagamento parcial ou total do preço da reserva. Ele não transfere a posse do aparelho antes da quitação e da retirada ou envio, conforme as regras da plataforma.
7.3 Valor e Pix: o valor informado na tela é o valor daquele aporte, e o código Pix gerado vale só para esse lançamento. O aporte é confirmado quando o sistema reconhece a compensação. Valor mínimo, saldo restante e status da reserva aparecem na tela do aporte.
7.4 Registro: cada aporte fica registrado com data e hora, valor, reserva e a sua conta.
7.5 Cancelamento e saque: valem as regras de cancelamento, reembolso, taxa e retirada destes Termos.
7.6 Declaração: ao gerar um Pix de aporte, você confirma que os dados da conta são seus e que o valor parte de decisão sua.
Texto sujeito à versão final do contrato enviada pela iPlanet.

8. Aceite
Ao criar conta e marcar os aceites, você declara ter lido estes termos, o contrato de aporte, a política de saque e as regras de retirada, indicação e sorteio.
`.trim();
