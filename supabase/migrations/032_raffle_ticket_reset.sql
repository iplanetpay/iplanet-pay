-- 032: Zerar fichas após o sorteio (snapshot reversível) e mínimo de 30% por reserva

insert into public.app_settings (key, value) values
  ('raffle_min_progress_pct', '30')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Resets de fichas
-- ---------------------------------------------------------------------------

create table if not exists public.raffle_ticket_resets (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid references public.monthly_raffle_draws (id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  users_count integer not null default 0 check (users_count >= 0),
  total_tickets integer not null default 0 check (total_tickets >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references auth.users (id) on delete set null
);

comment on column public.raffle_ticket_resets.snapshot is
  'user_id → fichas brutas no momento do reset. O reset ativo mais recente é subtraído das fichas; reverter (reverted_at) remove o desconto.';

create unique index if not exists raffle_ticket_resets_active_draw_idx
  on public.raffle_ticket_resets (draw_id)
  where reverted_at is null;

create index if not exists raffle_ticket_resets_created_idx
  on public.raffle_ticket_resets (created_at desc);

alter table public.raffle_ticket_resets enable row level security;

drop policy if exists raffle_ticket_resets_admin on public.raffle_ticket_resets;
create policy raffle_ticket_resets_admin on public.raffle_ticket_resets
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

revoke all on table public.raffle_ticket_resets from anon;

-- ---------------------------------------------------------------------------
-- Fichas = floor(aportes confirmados em reservas com ≥ 30% / 10000) − baseline do reset ativo
-- ---------------------------------------------------------------------------

create or replace function public.user_raffle_tickets(p_user_id uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select coalesce(p_user_id, auth.uid()) as user_id
  ),
  per_reservation as (
    select r.list_price_cents, sum(c.amount_cents)::bigint as cents
    from public.contributions c
    join public.reservations r on r.id = c.reservation_id
    where c.user_id = (select user_id from target) and c.status = 'confirmed'
    group by r.id, r.list_price_cents
  ),
  raw as (
    select floor(
      coalesce(
        sum(cents) filter (
          where list_price_cents > 0
            and cents * 100 >= list_price_cents * public.get_setting_numeric('raffle_min_progress_pct', 30)
        ),
        0
      )::numeric / nullif(public.get_setting_int('ficha_cents_per_ticket', 10000), 0)
    )::integer as tickets
    from per_reservation
  ),
  baseline as (
    select coalesce((rtr.snapshot ->> (select user_id from target)::text)::integer, 0) as tickets
    from public.raffle_ticket_resets rtr
    where rtr.reverted_at is null
    order by rtr.created_at desc
    limit 1
  )
  select greatest(
    0,
    coalesce((select tickets from raw), 0) - coalesce((select tickets from baseline), 0)
  )::integer;
$$;

grant execute on function public.user_raffle_tickets(uuid) to authenticated, service_role;
