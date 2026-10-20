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

1. Google Cloud → OAuth Client (Web) → Authorized redirect URI =
   `https://zjnikfrledckmjahwnsb.supabase.co/auth/v1/callback`
2. Supabase → Authentication → Providers → Google → colar Client ID + Secret
3. Supabase → Authentication → URL Configuration → Redirect URLs:
   `http://127.0.0.1:3000/auth/callback` (+ produção)
4. Não inventar / commit secrets — só no dashboard Supabase

Perfil: trigger `handle_new_user` cria `profiles` com role `cliente` (admins existentes preservados).

## App iOS (SwiftUI)

O app nativo fica em `ios/` e fala com o **mesmo Supabase** do PWA, pelo pacote oficial `supabase-swift` (Swift Package Manager, versão 2.55.4). Não usa Capacitor, CocoaPods nem WebView. O build web/PWA não muda.

Abra no Mac (Xcode 27): `ios/iPlanetPay.xcodeproj`.

### Simulador

```bash
cd /caminho/do/iplanet-pay
open ios/iPlanetPay.xcodeproj
```

1. Na primeira abertura, o Xcode baixa o pacote `supabase-swift` (precisa de internet). Espere o resolve terminar.
2. No seletor de destino, escolha um **iPhone Simulator** (iOS 18 ou superior; o projeto foi feito para o Xcode 27).
3. Confira **Signing & Capabilities**: *Automatically manage signing* já vem marcado e **Team** fica vazio. No simulador, Run assina localmente sem time.
4. Aperte **Run** (⌘R).

A URL, a anon key e a URL do site vêm de `ios/Config/Secrets.xcconfig` (já preenchido com os mesmos valores públicos do app web). O exemplo está em `ios/Config/Secrets.xcconfig.example`.

### iPhone físico

1. Conecte o iPhone e selecione-o como destino.
2. Em **Signing & Capabilities**, escolha o seu **Team**.
3. No iPhone: Ajustes → Geral → VPN e gerenciamento de dispositivo → confiar no desenvolvedor.
4. Run.

### App Store (depois)

- Bundle id: `com.iplanetpay.app`. Nome na tela: **iPlanet Pay**.
- Ícone: `ios/iPlanetPay/Assets.xcassets/AppIcon.appiconset` (a partir de `public/icons`).
- Archive com o destino **Any iOS Device**, depois Organizer → Distribute App.
- Preencha a conta Apple Developer, privacidade (fotos da biblioteca) e a classificação. O app não declara criptografia própria (`ITSAppUsesNonExemptEncryption` = false); o login usa HTTPS.
- Deep link do app: `iplanetpay://auth-callback` (login Google, confirmação de e-mail e senha), `iplanetpay://reserva/<uuid>` e `iplanetpay://catalogo`. Universal Links ficam para uma etapa seguinte: é preciso um arquivo `apple-app-site-association` no site e a capability Associated Domains. Isso não foi ligado agora para o simulador assinar sem capability extra.

### Supabase (obrigatório para o login do app)

No dashboard do projeto `zjnikfrledckmjahwnsb`:

Authentication → URL Configuration → **Redirect URLs**, inclua:

- `iplanetpay://auth-callback`

Authentication → Providers → Google: o redirect do Google Cloud continua `https://zjnikfrledckmjahwnsb.supabase.co/auth/v1/callback`. O app só precisa da URL acima na lista de redirects do Supabase.

Se “Confirm email” estiver ligado, o link do e-mail precisa cair nesse redirect para abrir o app. Sem isso, a conta é criada e o usuário confirma no navegador e depois entra com e-mail e senha.

O QR Code Pix continua no servidor (Mercado Pago). O app cria o aporte pendente via RPC `create_contribution` e mostra o código quando ele já está na linha. Não coloque `MERCADOPAGO_ACCESS_TOKEN` no app.

## Migrations

`supabase/migrations/001` … `017` — projeto live `zjnikfrledckmjahwnsb`.

Cron stale: `GET/POST /api/cron/stale-reservations` com `Authorization: Bearer $CRON_SECRET`.
