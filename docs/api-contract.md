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

Segredos que nunca entram no app: service role, Mercado Pago, Evolution/WhatsApp, `CRON_SECRET`, `OPENWEATHER_API_KEY`.

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
| `POST /api/reservations` | sim | `product_id`, `store_id` | `id`, `redirectTo` |
| `POST /api/reservations/cancel` | sim | `reservation_id` | `id` ou erro da política de cancelamento |
| `GET /api/reservations/{id}/contributions` | sim | — | `contributions[]` |
| `POST /api/reservations/{id}/contributions` | sim | `amount_cents` ou `amount_brl`, `contract_id?` | mesmo formato de `/api/pix/generate` |
| `POST /api/reservations/{id}/switch` | sim | `product_id` | `id` |
| `POST /api/reservations/{id}/pickup` | sim | `mode` `store`\|`shipping`, `shipping_method?`, `address?`, `freight_cents?`, `insurance_cents?`, `loan_contract_signed?` | pedido criado. Abaixo de 70% recusa. De 70% a 99% exige `loan_contract_signed: true` |
| `POST /api/reservations/{id}/retirada` | sim | — | confirma retirada quando a regra do site permite |
| `POST /api/pix/generate` | sim | `reservation_id`, `amount_cents` ou `amount_brl`, `contract_id?` | `contribution_id`, `amount_cents`, `gateway_configured`, `pix` `{ copy_paste, qr_base64, charge_id, provider }` ou `pix: null` e `error` se o gateway não estiver configurado |
| `POST /api/aportes/contract` | sim | `reservation_id`, `scrolled_to_end: true`, `contract_version?`, `fingerprint` objeto | `contract_id` |
| `POST /api/goals` | sim | Com plano: `name`, `product_id`, `start_date`, `target_date`, `frequency` (`daily`\|`weekly`\|`monthly`), `reservation_id?`. Sem frequência: meta legada com `amount_cents`, `installment_cents`, `installments_count`, `reminder_day?`, `whatsapp_phone?` | `goal_id`, e no plano também `reservation_id` |
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
| `GET /api/weather` | sim | `lat`, `lon` opcionais | `source` `openweather`\|`fallback`\|`needs_location`, `kind?`. A chave do OpenWeather fica no servidor |

`401` quando falta sessão nas rotas marcadas. `400` para regra de negócio. Corpo inválido: `{ ok: false, error: "JSON inválido." }` onde a rota distingue o parse.

## Leituras

Listas simples (perfil, catálogo, reservas, aportes, metas, carteira, indicações, avisos) podem ir direto ao PostgREST com a chave publishable e o JWT do usuário, sob RLS. Ranking de outras pessoas e criação de Pix, reserva, meta, saque, retirada e troca de usado passam pela API acima.

## Pix

O app chama `POST /api/pix/generate`. Não fala com o Mercado Pago. O QR mostrado no aparelho é gerado do copia-e-cola (`CIQRCodeGenerator`). A confirmação chega pelo webhook `POST /api/webhooks/pix` (só o servidor). O app observa `contributions` via Realtime ou consulta de novo enquanto a tela está aberta.
