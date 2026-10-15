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
| `WAHA_API_*` / `AGENT_API_KEY` | Disparos WhatsApp (WAHA) |
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

## Migrations

`supabase/migrations/001` … `017` — projeto live `zjnikfrledckmjahwnsb`.

Cron stale: `GET/POST /api/cron/stale-reservations` com `Authorization: Bearer $CRON_SECRET`.
