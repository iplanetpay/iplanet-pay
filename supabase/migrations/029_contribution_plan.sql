-- 029: cadence and start date for the contribution simulator (payment_goals)

alter table public.payment_goals
  add column if not exists frequency text
    check (
      frequency is null
      or frequency = any (array['daily'::text, 'weekly'::text, 'monthly'::text])
    );

alter table public.payment_goals
  add column if not exists plan_start_date date;

comment on column public.payment_goals.frequency is
  'Cadência do simulador de aportes: daily, weekly ou monthly.';

comment on column public.payment_goals.plan_start_date is
  'Início do plano. As datas de aporte são posteriores a este dia e incluem target_date.';

create index if not exists payment_goals_reservation_idx
  on public.payment_goals (reservation_id)
  where reservation_id is not null;
