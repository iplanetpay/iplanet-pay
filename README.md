# iPlanet Pay

Layaway inteligente (crediário via Pix) para produtos Apple nas lojas **iPlanet** (Itaim Bibi & São Caetano).

Stack: **Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase · framer-motion · recharts**.

UI 100% pt-BR · accent `#0071e3` · estética Apple-premium.

## Bootstrap admin

| Campo | Valor |
|-------|-------|
| E-mail | `admin@iplanet.com.br` |
| Senha | `1234` |
| Papel | `admin` (profiles + app_metadata) |

> Credenciais de bootstrap pedidas pelo time — troque em produção.

## Como rodar

```bash
cp .env.example .env.local
# preencha Supabase; deixe MP/AI/WhatsApp/Resend vazios até o produto 100%
npm install
npm run dev
```

Abra [http://127.0.0.1:3000](http://127.0.0.1:3000).

## O que já está pronto

- Landing com catálogo (hero) + deep link `?product=slug` → auth → reserva
- Estoque infinito (RPCs sem hold em `store_stock`; UI de estoque removida)
- Logo wordmark `public/logo-iplanet-pay.png` (nav); painéis sem BackButton (menu lateral)
- Motion (page transitions, cards, parallax)
- Admin Dashboards (`/admin/dashboards`) + `analytics_events`
- FAQ chat + WhatsApp handoff (`app_settings.whatsapp_support`)
- Stubs agente via WhatsApp admin (`/api/agent/*`) — 503 sem chaves; Telegram removido
- E-mails brandados (confirm / aporte / lembrete 30d) + `email_outbox` + cron stub

## Bloqueado em chaves (não inventar)

| Chave | Uso |
|-------|-----|
| `MERCADOPAGO_*` | Pix real |
| `RESEND_API_KEY` | Envio real de e-mail (senão outbox) |
| `EVOLUTION_API_*` / `AGENT_API_KEY` | Disparos WhatsApp (Evolution) |
| `CRON_SECRET` | Lembrete + auto-cancel zeradas 30d |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks Pix + outbox + cron RPC |

## E-mails

- Templates HTML: `src/lib/email/templates/`
- Auth Confirm signup: `supabase/templates/confirm-signup.html` (colar no dashboard Auth)
- Preview admin: `/admin/emails/preview?template=aporte_confirmado`
- Cron: `GET/POST /api/cron/aporte-reminder` com `Authorization: Bearer $CRON_SECRET`

## Rotas principais

| Path | Descrição |
|------|-----------|
| `/` | Landing / catálogo |
| `/entrar` · `/criar-conta` | Auth (+ `?product=`) |
| `/app/*` | Cliente |
| `/admin/dashboards` | Métricas |
| `/admin/config` | WhatsApp, agente, gateways |
| `/admin/emails/preview` | QA e-mails |


## Google OAuth

App wiring: `signInWithOAuth({ provider: 'google' })` → `/auth/callback` (PKCE).

O site em produção (`https://iplanet-pay.vercel.app`) usa o projeto Supabase `xeeogfmmasvgbpmodqym`. `next.config.ts` ainda cai no projeto pausado `zjnikfrledckmjahwnsb` quando `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` vêm vazios — a Vercel preenche essas variáveis, então o build publicado não usa esse fallback.

1. Google Cloud → OAuth Client (Web) → Authorized redirect URI =
   `https://xeeogfmmasvgbpmodqym.supabase.co/auth/v1/callback`
2. Supabase → Authentication → Providers → Google → colar Client ID + Secret
3. Supabase → Authentication → URL Configuration → Redirect URLs:
   `http://127.0.0.1:3000/auth/callback` (+ produção)
4. Não inventar / commit secrets — só no dashboard Supabase

Perfil: trigger `handle_new_user` cria `profiles` com role `cliente` (admins existentes preservados).

## App iOS (SwiftUI)

O app nativo fica em `ios/` e fala com o **mesmo Supabase do site em produção** (`https://xeeogfmmasvgbpmodqym.supabase.co`), pelo pacote oficial `supabase-swift` 2.55.4 (Swift Package Manager). Também usa `GoogleSignIn-iOS` 9.2.0, só para o login nativo quando houver um client ID iOS. Não usa Capacitor, CocoaPods nem WebView. O build web/PWA não muda.

Abra no Mac (Xcode 27): `ios/iPlanetPay.xcodeproj`.

### Simulador

```bash
cd /caminho/do/iplanet-pay
open ios/iPlanetPay.xcodeproj
```

1. Na primeira abertura, o Xcode baixa `supabase-swift` e `GoogleSignIn-iOS` (precisa de internet). Espere o resolve terminar.
2. No seletor de destino, escolha um **iPhone Simulator** (iOS 18 ou superior; o projeto foi feito para o Xcode 27).
3. Confira **Signing & Capabilities**: *Automatically manage signing* já vem marcado e **Team** fica vazio. No simulador, Run assina localmente sem time.
4. Aperte **Run** (⌘R).

URL, chave publishable (`sb_publishable_…`, a mesma pública do bundle web) e URL do site vêm de `ios/Config/Secrets.xcconfig`. O exemplo está em `ios/Config/Secrets.xcconfig.example`. O `supabase-swift` 2.55.4 aceita essa chave: o gateway responde 200 em `auth/v1/health` e em `rest/v1/profiles` com o header `apikey`.

### iPhone físico

1. Conecte o iPhone e selecione-o como destino.
2. Em **Signing & Capabilities**, escolha o seu **Team**.
3. No iPhone: Ajustes → Geral → VPN e gerenciamento de dispositivo → confiar no desenvolvedor.
4. Run.

Sign in with Apple pede a capability no App ID (`com.iplanetpay.app`). Sem conta Apple Developer paga, o botão da Apple pode falhar no aparelho. O app avisa em português quando o provedor Apple está desligado no Supabase.

### App Store (depois)

- Bundle id: `com.iplanetpay.app`. Nome na tela: **iPlanet Pay**.
- Ícone: `ios/iPlanetPay/Assets.xcassets/AppIcon.appiconset` (a partir de `public/icons`).
- Archive com o destino **Any iOS Device**, depois Organizer → Distribute App.
- Preencha a conta Apple Developer, privacidade (fotos da biblioteca) e a classificação. O app não declara criptografia própria (`ITSAppUsesNonExemptEncryption` = false); o login usa HTTPS.
- Deep link do app: `iplanetpay://auth-callback` (Google, confirmação de e-mail, link mágico e senha), `iplanetpay://reserva/<uuid>` e `iplanetpay://catalogo`. Universal Links ficam para uma etapa seguinte: é preciso um arquivo `apple-app-site-association` no site e a capability Associated Domains. Isso não foi ligado agora para o simulador assinar sem capability extra.

### Checklist antes do TestFlight

1. Publicar na Vercel o aceite de `Authorization: Bearer` nas rotas da API. Sem esse deploy, login nativo, Pix, meta, saque, retirada e troca de usado falham no app.
2. Não há migração nova para aplicar.
3. Não há envio APNs no backend (o lembrete de meta segue pelo cron de WhatsApp). O app não pede push.
4. Conferir no simulador iPhone 16 (390×844): abas Início, Catálogo, Wallet, Metas, Indicações e Conta; carrossel; Pix com QR local; metas com cena e calendário; atalho Admin só abre o site.
5. Conta Apple Developer paga ainda não existe: Sign in with Apple fica no código e será ligado depois. Google continua no fluxo OAuth do navegador.

### Supabase (projeto `xeeogfmmasvgbpmodqym`)

Redirect URLs já incluem `iplanetpay://auth-callback` e `iplanetpay://**`.

**Google (caminho que funciona hoje).** Não há client ID iOS. O botão “Continuar com Google” abre `ASWebAuthenticationSession` e volta para `iplanetpay://auth-callback`. O provedor Google do Supabase está ligado com o client ID Web `940958699246-l1ie964lhrri5ejnot899nu2uldat5n3.apps.googleusercontent.com` e *Skip nonce check* desligado. Não coloque esse client ID Web em `GOOGLE_IOS_CLIENT_ID`: o app tentaria o login nativo com um cliente de navegador. O redirect do Google Cloud continua `https://xeeogfmmasvgbpmodqym.supabase.co/auth/v1/callback`.

Para ligar o Google nativo depois:

1. Google Cloud → criar um OAuth Client **iOS** com bundle id `com.iplanetpay.app`.
2. Em `ios/Config/Secrets.xcconfig`, trocar os dois placeholders: `GOOGLE_IOS_CLIENT_ID` e o scheme reverso `com.googleusercontent.apps.<prefixo>`.
3. Supabase → Providers → Google → **Authorized Client IDs**: acrescentar esse client ID iOS (não substitui o Web).
4. *Skip nonce check* pode continuar desligado: o caminho nativo manda o hash do nonce ao Google e o nonce cru ao Supabase.

**Apple (implementado, provedor desligado).** O app já tem o botão nativo, o nonce e a entitlement `com.apple.developer.applesignin`. O dashboard ainda não habilita o provedor Apple. Se o usuário tocar no botão e o Supabase responder que o provedor está desligado, a tela mostra um aviso em pt-BR e sugere e-mail ou Google. Quando houver conta Apple Developer:

1. Apple Developer → Identifiers → App ID `com.iplanetpay.app` → ligar Sign in with Apple.
2. Criar um Services ID e uma chave Sign in with Apple (.p8).
3. Supabase → Providers → Apple → Services ID, Team ID, Key ID, chave, e o bundle id `com.iplanetpay.app` como client ID autorizado.

**E-mail.** “Confirm email” está ligado. O cadastro pede a confirmação e manda o link com redirect `iplanetpay://auth-callback`. CPF, endereço, termos (`platform-v2`) e código de indicação ficam neste aparelho e são gravados no perfil quando o link cria a sessão.

O QR Code Pix continua no servidor (Mercado Pago). O app cria o aporte pendente via RPC `create_contribution` e mostra o código quando ele já está na linha. Não coloque `MERCADOPAGO_ACCESS_TOKEN` no app.

## Migrations

`supabase/migrations/001` … `017` — histórico aplicado no projeto antigo `zjnikfrledckmjahwnsb` (pausado). O app iOS e o site em produção usam `xeeogfmmasvgbpmodqym`.

Cron stale: `GET/POST /api/cron/stale-reservations` com `Authorization: Bearer $CRON_SECRET`.
