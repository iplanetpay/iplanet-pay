# Carteira / aportes

- **SoT do progresso pago:** `reservations.amount_paid_cents` (só via `confirm_contribution` / `admin_confirm_contribution`).
- **`wallet_ledger`:** extrato append-only; `amount_cents` com sinal (+crédito / −débito).
- **Crédito:** nunca no client. Webhook (service_role) ou staff via `admin_confirm_contribution`.
- **Criação:** `create_contribution` (authenticated, dono, reserva `ativa`, mín. R$5).

## WhatsApp após primeiro aporte
Após o primeiro `confirmed` por reserva (webhook ou `admin_confirm_contribution`), `notifyFirstAporteWhatsapp` enfileira o template `primeiro_aporte` e, se houver `payment_goals.reminder_at`, agenda `cobranca_lembrete` na `whatsapp_dispatch_queue`. Sem `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE`, o status fica `skipped`.
