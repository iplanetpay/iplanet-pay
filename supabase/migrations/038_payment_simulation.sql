-- iPlanet Pay · 038 · Pagamento simulado (somente teste)
-- POST /api/dev/simulate-payment confirma um Pix pendente pelo mesmo caminho do
-- webhook do Mercado Pago (confirm_contribution via service role). Esta migration só
-- marca o aporte como simulado e guarda um registro de cada simulação.
-- Nada aqui abre escrita para anon/authenticated.

alter table public.contributions
  add column if not exists simulated_at timestamptz,
  add column if not exists simulated_by uuid references auth.users (id) on delete set null;

comment on column public.contributions.simulated_at is
  'Preenchido quando o aporte foi confirmado por /api/dev/simulate-payment (teste, sem Pix real).';

create table if not exists public.payment_simulation_log (
  id bigint generated always as identity primary key,
  contribution_id uuid not null references public.contributions (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  payment_ref text,
  result text not null,
  created_at timestamptz not null default now()
);

create index if not exists payment_simulation_log_contribution_idx
  on public.payment_simulation_log (contribution_id);

alter table public.payment_simulation_log enable row level security;

drop policy if exists payment_simulation_log_admin_select on public.payment_simulation_log;
create policy payment_simulation_log_admin_select on public.payment_simulation_log
  for select to authenticated
  using (public.current_user_role() = 'admin'::public.user_role);

revoke all on table public.payment_simulation_log from anon;
revoke insert, update, delete on table public.payment_simulation_log from authenticated;
grant select on table public.payment_simulation_log to authenticated;
