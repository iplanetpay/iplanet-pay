import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { GuideList, GuideSection } from "@/components/docs/guide-section";

export const metadata: Metadata = {
  title: "Guia do administrador",
  description:
    "Como operar reservas, financeiro, catálogo, indicações e sorteio no iPlanet Pay.",
};

const TOC = [
  ["acesso", "Acesso"],
  ["overview", "Overview"],
  ["reservas", "Reservas"],
  ["financeiro", "Financeiro"],
  ["catalogo", "Produtos e clientes"],
  ["usados", "Usados"],
  ["indicacoes", "Indicações"],
  ["sorteio", "Sorteio"],
  ["comunicacao", "WhatsApp e config"],
] as const;

export default function AdminAjudaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Guia da operação"
        description="O que cada tela faz e em que ordem um pedido anda."
        size="xl"
      />

      <Card>
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
          O cliente usa a área em /app. Esta área é só de quem tem o papel{" "}
          <strong className="text-[var(--ink)]">admin</strong>. O guia do
          público está em{" "}
          <Link href="/ajuda" className="font-medium text-[var(--accent)] underline">
            Como funciona
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

      <GuideSection id="acesso" title="Acesso">
        <p>
          Entre com a conta de administrador. O papel é definido em Clientes.
          Uma conta Google comum entra como cliente até alguém alterar o papel
          para admin.
        </p>
        <p>
          Papéis de staff e parceiro existem no cadastro antigo e não abrem
          painel. A operação do dia a dia é feita aqui.
        </p>
      </GuideSection>

      <GuideSection id="overview" title="Overview">
        <p>
          A tela inicial mostra a soma de aportes confirmados, a quantidade
          pendente, as lojas e a fila de reservas prontas para retirada.
          Dashboards resume os últimos 30 dias: acessos, cliques, aportes e
          contas novas.
        </p>
      </GuideSection>

      <GuideSection id="reservas" title="Reservas">
        <p>
          Busque por cliente, produto ou identificador. Dá para cancelar uma
          reserva ativa e confirmar a retirada quando o cliente buscar o
          aparelho.
        </p>
        <p>
          Abaixo da lista ficam as solicitações de retirada na loja e de envio.
          Envio fica aguardando o Pix de frete e seguro. Os status seguintes
          são pronto para retirada, enviado, entregue ou cancelado.
        </p>
        <GuideList
          items={[
            "Ativa — o cliente ainda aporta.",
            "Quitada — o preço de lista foi coberto. A fila de retirada usa esse momento.",
            "Retirada — a loja confirmou a entrega.",
            "Saque pendente — há um pedido de devolução no Financeiro.",
            "Sacada — o saque foi aprovado e a reserva não recebe novos aportes.",
          ]}
        />
      </GuideSection>

      <GuideSection id="financeiro" title="Financeiro">
        <p>
          Aportes <strong>confirmados</strong> já entraram no saldo da reserva.
          Pendentes ainda não. O painel também lista o fechamento por dia.
        </p>
        <p>
          Em saques, aprove ou rejeite o pedido. O cliente só consegue pedir
          saque com conta de pelo menos 15 dias, reserva ativa e mais de R$
          1.000,00 confirmados naquela reserva. A taxa é 30%. O cliente recebe
          70% na chave Pix do pedido.
        </p>
        <p>
          Ao aprovar, a reserva passa a Sacada e o pagamento segue o status
          Aguardando admin, Aguardando gateway, Na fila, Enviado ou Falhou. O
          cliente vê o desconto da taxa no histórico quando o status está{" "}
          <strong>Enviado</strong>. A estimativa enviada a ele é de até 24
          horas úteis depois da aprovação.
        </p>
      </GuideSection>

      <GuideSection id="catalogo" title="Produtos e clientes">
        <p>
          Em Produtos, cadastre o aparelho, o preço de lista, as fotos e a
          categoria. A primeira imagem é a capa. Categorias ativas alimentam as
          abas do catálogo público.
        </p>
        <p>
          Em Clientes, busque por nome ou telefone, veja as reservas e altere o
          papel entre cliente e admin.
        </p>
      </GuideSection>

      <GuideSection id="usados" title="Avaliação de usados">
        <p>
          A fila mostra ofertas de aparelhos usados enviadas pelo cliente, com
          as fotos. Avalie a oferta para ela valer como parte do pagamento da
          reserva.
        </p>
      </GuideSection>

      <GuideSection id="indicacoes" title="Indicações">
        <p>
          A lista mostra quem indicou quem e o estado de cada indicação. O
          bônus só libera depois que o indicado confirma pelo menos R$ 100,00
          em aportes. O valor do bônus, em centavos, é ajustado em Config.
        </p>
      </GuideSection>

      <GuideSection id="sorteio" title="Sorteio">
        <p>
          Cada R$ 100,00 confirmados geram 1 ficha. A tela de Sorteio ordena os
          clientes por fichas e serve o sorteio mensal do dia 1, inclusive para
          mostrar ao vivo.
        </p>
      </GuideSection>

      <GuideSection id="comunicacao" title="WhatsApp e config">
        <p>
          WhatsApp guarda templates e a fila de disparo. O envio sai pela
          Evolution quando a instância está configurada. Em Config ficam o WhatsApp de suporte, o
          número do admin, o bônus de indicação e o estado dos gateways de
          pagamento e de login.
        </p>
        <p>
          Com <code>ALLOW_PAYMENT_SIMULATION=true</code> na Vercel, a tela do Pix
          (site e app) mostra o botão <strong>Pago (teste)</strong>: o aporte é
          confirmado pelo mesmo caminho do webhook do Mercado Pago, sem Pix cobrado,
          e fica marcado como simulado. Desligue a variável quando as chaves de
          produção do Mercado Pago entrarem.
        </p>
      </GuideSection>
    </div>
  );
}
