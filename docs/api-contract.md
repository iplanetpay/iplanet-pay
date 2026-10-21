# Contrato da API Web (área do cliente)

Base: `WEB_APP_URL` (produção `https://www.iplanetpay.com.br`). Independente de plataforma. O app iOS e um futuro Android usam o mesmo contrato.

Dinheiro em centavos inteiros. Datas civis `yyyy-mm-dd` no calendário `America/Sao_Paulo`. Erro: JSON `{ "ok": false, "error": "mensagem" }`. Corpo que não é JSON é falha (`src/lib/http/read-json.ts`).

## Autenticação

O site continua com cookie httpOnly do `@supabase/ssr`. Nada muda quando o corpo não traz `client`.

O app nativo envia, nas rotas que leem ou escrevem dados do usuário:

```
Authorization: Bearer <access_token>
```

O token é o JWT da sessão Supabase (três segmentos). `getCurrentUser` valida com `supabase.auth.getUser(token)`. O client PostgREST usa esse JWT, então a RLS do usuário vale. Um `Authorization` que não é JWT (por exemplo o segredo do cron) não troca o caminho do cookie.

Segredos que nunca entram no app: service role, Mercado Pago, Evolution/WhatsApp, `CRON_SECRET`.

### Sessão nativa

`POST /api/auth/login` e `POST /api/auth/signup` devolvem `access_token`, `refresh_token` e `expires_at` somente quando o corpo tem `"client": "native"` e existe sessão. O site não envia esse campo.

O link mágico do app é iniciado no aparelho (`signInWithOTP`, redirect `iplanetpay://auth-callback`) para o verificador PKCE ficar no Keychain. `POST /api/auth/magic-link` continua no servidor: sem `redirectTo` o destino é `{origem}/app`; `iplanetpay://auth-callback` e URLs da mesma origem são aceitos; qualquer outra origem cai em `{origem}/app`.

Google no app: OAuth `ASWebAuthenticationSession` até existir client ID iOS. Apple: Sign in with Apple nativo; o provedor pode estar desligado no Supabase.

## Rotas

Todas as respostas de sucesso incluem `ok: true`, salvo indicação.

| Método e caminho | Auth | Corpo / query | Sucesso |
| --- | --- | --- | --- |
| `POST /api/auth/login` | não | `email`, `password`, `next?`, `client?` | `redirectTo`, `warning?`, `mode`; tokens se `client=native` |
| `POST /api/auth/signup` | não | `full_name`, `email`, `password`, `phone`, `cpf`, `city`, `state`, `address`, `address_number`, `birth_date`, `terms_accepted`, `terms_version?`, `referral_code?`, `client?` | `redirectTo`, `needs_email_confirmation`, `mode`; tokens se houver sessão e `client=native` |
| `POST /api/auth/magic-link` | não | `email`, `redirectTo?` | `message`, `mode` |
| `POST /api/auth/logout` | cookie ou Bearer | vazio | `{ ok: true }` |
| `PATCH /api/profile` | sim | `full_name?`, `phone?`, `email?`, `avatar_url?`, `pix_key?`, `pix_key_type?` | `email_pending` |
| `POST /api/profile/identity` | sim | `phone`, `cpf`, `city`, `state`, `address`, `address_number`, `birth_date` | `{ ok: true }` |
| `POST /api/profile/avatar` | sim | `multipart` campo `file` (imagem) | `avatar_url` |
| `POST /api/profile/password` | sim | `password` (mínimo 8) | `{ ok: true }` |
| `POST /api/reservations` | sim | `product_id`, `store_id`, `variant_id?` (id de `product_variants` ativa do mesmo produto; a reserva usa o preço dela) | `id`, `redirectTo` |
| `POST /api/reservations/cancel` | sim | `reservation_id` | `id` ou erro da política de cancelamento |
| `GET /api/reservations/{id}/contributions` | sim | — | `contributions[]` |
| `POST /api/reservations/{id}/contributions` | sim | `amount_cents` ou `amount_brl`; `contract_id?` obsoleto e ignorado se inválido | mesmo formato de `/api/pix/generate` |
| `POST /api/reservations/{id}/switch` | sim | `product_id` | `id` |
| `POST /api/reservations/{id}/pickup` | sim | `mode` `store`\|`shipping`, `shipping_method?`, `address?`, `freight_cents?`, `insurance_cents?`, `loan_contract_signed?` | pedido criado. Abaixo de 70% recusa. De 70% a 99% exige `loan_contract_signed: true` |
| `POST /api/reservations/{id}/retirada` | sim | — | confirma retirada quando a regra do site permite |
| `POST /api/pix/generate` | sim | `reservation_id`, `amount_cents` ou `amount_brl`; `contract_id?` obsoleto (não é mais exigido; se vier e for do usuário, é ligado ao lançamento) | `contribution_id`, `amount_cents`, `gateway_configured`, `pix` `{ copy_paste, qr_base64, charge_id, provider }` ou `pix: null` e `error` se o gateway não estiver configurado |
| `POST /api/aportes/contract` | sim | **Obsoleto.** `reservation_id`, `scrolled_to_end: true`, `contract_version?`, `fingerprint` objeto. Continua respondendo para apps antigos, mas o aceite por aporte não é mais necessário: o contrato de aporte está nos Termos de Uso (item 7, versão `platform-v3`) e é aceito no cadastro (`terms_accepted`, `terms_version`) | `contract_id` |
| `POST /api/goals` | sim | Com plano: `name`, `product_id`, `start_date`, `target_date`, `frequency` (`daily`\|`weekly`\|`monthly`), `reservation_id?`, `variant_id?` (sem reserva: cria a reserva da variante, com o preço dela). Sem frequência: meta legada com `amount_cents`, `installment_cents`, `installments_count`, `reminder_day?`, `whatsapp_phone?` | `goal_id`, e no plano também `reservation_id` |
| `POST /api/wallet/apply` | sim | `reservation_id`, `amount_cents` | aplica crédito de indicação na reserva |
| `POST /api/wallet/withdraw` | sim | `amount_cents` (mínimo 100000), `pix_key`, `pix_key_type`, `holder_full_name`, `holder_cpf` | saque da carteira, taxa 30% |
| `POST /api/withdrawals/request` | sim | `reservation_id` | pedido de saque do valor aportado da reserva, taxa 30% |
| `POST /api/referrals/apply` | sim | `code` | aplica código de quem indicou |
| `POST /api/referrals/apply-bonus` | sim | `reservation_id` | usa o bônus na reserva |
| `POST /api/trade-in/submit` | sim | até 5 aparelhos: modelo, IMEI, valores em centavos, manutenção, bateria (0–100 ou `unknown` / `not_applicable`), fotos já enviadas | oferta criada |
| `POST /api/trade-in/photos` | sim | `multipart` da foto, caminho com o id do usuário | `path` |
| `POST /api/trade-in/respond` | sim | `offerId`, `action` `accept`\|`reject`\|`resubmit`\|`discard`, `expectedCents?` | resposta à contra-proposta |
| `GET /api/notices` | sim | — | `notices[]` com `id`, `kind`, `title`, `body`, `couponCode`, `createdAt`, `read` |
| `POST /api/notices/read` | sim | `notice_id` | marca como lido |
| `POST /api/support/chat` | sim | `messages[]` `{ role: "user"\|"assistant", content }`, `stream?` (padrão `true`) | stream SSE ou `{ ok, reply, whatsapp }` — ver "Suporte com IA" |

`401` quando falta sessão nas rotas marcadas. `400` para regra de negócio. Corpo inválido: `{ ok: false, error: "JSON inválido." }` onde a rota distingue o parse.

## Leituras

Listas simples (perfil, catálogo, reservas, aportes, metas, carteira, indicações, avisos) podem ir direto ao PostgREST com a chave publishable e o JWT do usuário, sob RLS. Ranking de outras pessoas e criação de Pix, reserva, meta, saque, retirada e troca de usado passam pela API acima.

## Catálogo: variantes e cores

Leitura direta no PostgREST (RLS: público lê só `active = true`; só admin escreve).

- `products`: `id`, `name`, `model`, `storage`, `color`, **`color_hex`**, `list_price_cents`, `image_url`, `product_images`, `category`, `active`.
- `product_variants`: `id`, `product_id`, `model`, `color`, **`color_hex`**, `storage`, `price_cents`, `active`.

`color_hex` é texto `"#RRGGBB"` maiúsculo (check `^#[0-9A-F]{6}$`) ou `null`. O admin escolhe a cor no seletor; sem escolha o banco preenche pelo nome da cor (`public.color_hex_from_name`). Se vier `null`, o cliente usa o mesmo mapa por nome de `src/lib/catalog/colors.ts` e, sem correspondência, `#C7C7CC`.

O produto é a variante base (`variant_id` nulo, preço `list_price_cents`, cor `color`/`color_hex`). Cada linha de `product_variants` é outra combinação Cor × Armazenamento com `price_cents` próprio; linha sem `color` ou sem `storage` herda o eixo do produto. Combinação ausente fica indisponível.

```
GET /rest/v1/products?select=id,name,storage,color,color_hex,list_price_cents,product_variants(id,color,color_hex,storage,price_cents)&active=eq.true
```

```json
{
  "id": "uuid", "name": "iPhone 17", "storage": "256 GB", "color": "Lavanda", "color_hex": "#C9B8E8",
  "list_price_cents": 799900,
  "product_variants": [
    { "id": "uuid", "color": "Lavanda", "color_hex": "#C9B8E8", "storage": "512 GB", "price_cents": 949900 },
    { "id": "uuid", "color": "Preto", "color_hex": "#1D1D1F", "storage": "256 GB", "price_cents": 799900 }
  ]
}
```

A reserva grava `reservations.variant_id` (nulo sem variante). Admin: `POST /api/admin/products/{id}/variants` aceita `color_hex?`; `PATCH` com `variant_id`, `color_hex?`, `color?`, `active?`; `POST`/`PATCH /api/admin/products` aceitam `color_hex?`. Hex inválido → `400 { ok: false, error: "Cor inválida: use o formato #RRGGBB." }`.

## Pix

Não há aceite de contrato por aporte. O contrato de aporte faz parte dos Termos de Uso (`/termos#contrato-de-aporte`, versão `platform-v3`), aceitos no cadastro. O app não deve abrir tela de contrato antes do Pix.


O app chama `POST /api/pix/generate`. Não fala com o Mercado Pago. O QR mostrado no aparelho é gerado do copia-e-cola (`CIQRCodeGenerator`). A confirmação chega pelo webhook `POST /api/webhooks/pix` (só o servidor). O app observa `contributions` via Realtime ou consulta de novo enquanto a tela está aberta.

## Suporte com IA

`POST /api/support/chat`, cookie ou `Authorization: Bearer <access_token>`. A chave do provedor de IA nunca sai do servidor; o app não fala com o provedor.

Corpo:

```json
{ "messages": [{ "role": "user", "content": "Como gero o Pix?" }], "stream": true }
```

- O cliente guarda o histórico da sessão e manda a conversa inteira a cada pergunta. Só `user` e `assistant` são aceitos (qualquer `system` é descartado). Cada mensagem é cortada em 2.000 caracteres; ficam as 20 últimas. A última precisa ser `user`.
- O servidor acrescenta o arquivo de comportamento (admin → Config → Suporte com IA) e um resumo da conta lido sob a RLS do usuário (primeiro nome, até 5 reservas com status e progresso, até 5 metas).

`stream: true` (padrão): `200`, `Content-Type: text/event-stream`. Cada evento é uma linha `data: <json>` seguida de linha em branco:

```
data: {"type":"delta","text":"Na reserva, "}

data: {"type":"delta","text":"toque em Gerar Pix."}

data: {"type":"done"}
```

`{"type":"error","error":"mensagem"}` pode chegar no lugar de `done` se o provedor cair no meio. Concatene os `text` dos `delta`. A resposta é Markdown simples (`**negrito**`, listas `-`, títulos `#`).

`stream: false`: `{ "ok": true, "reply": "texto", "whatsapp": "5511999999999" | null }`.

Erros (JSON `{ ok: false, error }`):

| Status | Quando |
| --- | --- |
| `400` | JSON inválido ou histórico sem mensagem final do cliente |
| `401` | sem sessão |
| `429` | mais de 20 perguntas em 10 minutos para o mesmo usuário |
| `503` | IA desligada ou sem chave; traz `handoff: true` e `whatsapp` (dígitos) para mostrar "Falar no WhatsApp" |
| `502` | falha do provedor de IA |

Configuração (só admin, site): `POST /api/admin/support-ai` com `enabled`, `provider` (`openai`\|`xai`\|`openrouter`\|`groq`\|`custom`), `base_url` (https), `model`, `behavior_md`, `api_key?` (somente escrita), `clear_api_key?`. Responde `api_key_set` e `api_key_last4`; a chave nunca volta.
