import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { GuideList, GuideSection } from "@/components/docs/guide-section";

export const metadata: Metadata = {
  title: "Guia",
  description:
    "Como reservar, aportar via Pix, retirar o aparelho, indicar amigos e pedir saque no iPlanet Pay.",
};

const TOC = [
  ["conta", "Conta"],
  ["reserva", "Reserva"],
  ["aportes", "Aportes"],
  ["aparelho", "Retirada e envio"],
  ["saque", "Saque"],
  ["indicacoes", "Indicações"],
  ["sorteio", "Fichas e sorteio"],
  ["usado", "Aparelho usado"],
  ["status", "Status da reserva"],
] as const;

export default function AjudaPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-subtle)] px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          eyebrow="iPlanet Pay"
          title="Como funciona"
          description="Reserve um iPhone nas lojas iPlanet e quite no seu ritmo, com aportes via Pix."
        />

        <Card className="bg-white">
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
            As lojas são Itaim Bibi e São Caetano. O texto legal completo está
            nos{" "}
            <Link href="/termos" className="font-medium text-[var(--accent)] underline">
              Termos de uso
            </Link>
            .
          </p>
          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Neste guia">
            {TOC.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {label}
              </a>
            ))}
          </nav>
        </Card>

        <GuideSection id="conta" title="Conta">
          <p>
            Crie uma conta em <strong>Criar conta</strong> ou entre com e-mail
            e senha. <strong>Entrar com Google</strong> usa o nome e a foto da
            sua conta Google. Uma foto escolhida em Configurações permanece no
            perfil.
          </p>
          <p>
            Depois do login, a área do cliente tem Início, Catálogo, Wallet,
            Indicações e Conta. O número de fichas do sorteio aparece no topo.
          </p>
        </GuideSection>

        <GuideSection id="reserva" title="Reserva">
          <p>
            No catálogo, escolha o aparelho e a loja de retirada. A reserva
            nasce <strong>Ativa</strong> e passa a aparecer no Início. Enquanto
            estiver ativa, ela aceita novos aportes.
          </p>
          <p>
            Dá para trocar o aparelho de uma reserva ativa ou cancelá-la. O
            cancelamento não devolve sozinho o que já foi pago: a devolução
            segue a regra de saque.
          </p>
        </GuideSection>

        <GuideSection id="aportes" title="Aportes">
          <p>
            Na reserva, informe o valor e toque em <strong>Gerar Pix</strong>.
            O mínimo de cada aporte é R$ 5,00, até o valor que ainda falta.
            Antes do Pix, a tela pede o aceite do contrato daquele aporte.
          </p>
          <p>
            Um aporte <strong>pendente</strong> ainda não entrou no progresso.
            Ele conta quando o Pix é <strong>confirmado</strong>. O histórico
            da reserva lista cada pagamento.
          </p>
          <p>
            A Wallet reúne os aportes da sua conta. O progresso da reserva
            mostra quanto já foi confirmado e quanto falta para o preço de
            lista.
          </p>
        </GuideSection>

        <GuideSection id="aparelho" title="Retirada e envio">
          <GuideList
            items={[
              "Com 100% quitado, solicite retirada na loja ou envio. O envio cobra frete e seguro via Pix.",
              "A partir de 70% quitado, a entrega antecipada pede a assinatura do contrato de empréstimo do aparelho até a quitação.",
              "A loja confirma a retirada. Depois disso a reserva fica Retirada.",
            ]}
          />
          <p>
            O aporte não transfere a posse do aparelho antes da quitação e da
            retirada ou do envio.
          </p>
        </GuideSection>

        <GuideSection id="saque" title="Saque">
          <p>
            O saque devolve aportes confirmados de uma reserva{" "}
            <strong>Ativa</strong>. A conta precisa ter pelo menos{" "}
            <strong>15 dias</strong>, e a soma confirmada na reserva precisa
            passar de <strong>R$ 1.000,00</strong>. Bônus de indicação e
            aportes ainda pendentes ficam de fora dessa conta.
          </p>
          <p>
            A plataforma retém <strong>30%</strong> de taxa administrativa. Você
            recebe <strong>70%</strong> na chave Pix informada. Esse cálculo
            aparece no histórico depois que o saque é pago.
          </p>
          <p>
            O botão <strong>Solicitar saque</strong> fica no histórico de
            aportes, na visualização em tela cheia. Informe o tipo da chave, a
            chave, o nome do titular e o CPF. O Financeiro analisa o pedido. O
            Pix sai em até 24 horas úteis depois da aprovação.
          </p>
          <p>
            Enquanto o pedido está em análise, a reserva fica{" "}
            <strong>Saque pendente</strong>. Depois do pagamento, ela fica{" "}
            <strong>Sacada</strong> e não aceita novos aportes.
          </p>
        </GuideSection>

        <GuideSection id="indicacoes" title="Indicações">
          <p>
            Em Indicações, copie seu código e envie para um amigo. O bônus do
            indicador é liberado quando o indicado confirma pelo menos{" "}
            <strong>R$ 100,00</strong> em aportes. O valor do bônus é definido
            pela plataforma e pode ser aplicado em uma reserva ativa.
          </p>
        </GuideSection>

        <GuideSection id="sorteio" title="Fichas e sorteio">
          <p>
            Cada <strong>R$ 100,00</strong> em aportes confirmados vale{" "}
            <strong>1 ficha</strong>. O sorteio é mensal, no dia 1. Mais fichas
            aumentam a chance de liberação antecipada do aparelho. O ranking de
            aportes fica em Ranking.
          </p>
        </GuideSection>

        <GuideSection id="usado" title="Aparelho usado">
          <p>
            Na reserva, você pode oferecer um aparelho usado como parte do
            pagamento, com fotos. A equipe avalia a oferta e registra o
            resultado na mesma reserva.
          </p>
        </GuideSection>

        <GuideSection id="status" title="Status da reserva">
          <GuideList
            items={[
              "Ativa — aceita aportes.",
              "Quitada — o preço de lista foi coberto.",
              "Retirada — o aparelho foi entregue.",
              "Saque pendente — o pedido de devolução está em análise.",
              "Sacada — o saque foi concluído.",
              "Cancelada — a reserva foi encerrada.",
              "Trocada — o aparelho da reserva foi substituído.",
            ]}
          />
          <p>
            Dúvidas de atendimento seguem pelo WhatsApp da iPlanet, no rodapé
            do site.
          </p>
        </GuideSection>
      </div>
    </div>
  );
}
