-- 031: WhatsApp notice schedule per goal due date (day before + late) and editable templates

create table if not exists public.goal_whatsapp_schedule (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.payment_goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  due_date date not null,
  send_on date not null,
  kind text not null
    check (kind = any (array['day_before'::text, 'late'::text])),
  status text not null default 'pending'
    check (status = any (array['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  constraint goal_whatsapp_schedule_goal_due_kind_key unique (goal_id, due_date, kind)
);

comment on table public.goal_whatsapp_schedule is
  'Avisos de metas: um WhatsApp por data de aporte. day_before sai na véspera; late sai no dia seguinte se o aporte não foi feito.';

create index if not exists goal_whatsapp_schedule_due_idx
  on public.goal_whatsapp_schedule (send_on)
  where status = 'pending';

create index if not exists goal_whatsapp_schedule_user_idx
  on public.goal_whatsapp_schedule (user_id, due_date);

alter table public.goal_whatsapp_schedule enable row level security;

drop policy if exists goal_whatsapp_schedule_admin on public.goal_whatsapp_schedule;
create policy goal_whatsapp_schedule_admin
  on public.goal_whatsapp_schedule for all to authenticated
  using (public.current_user_role() = 'admin'::public.user_role)
  with check (public.current_user_role() = 'admin'::public.user_role);

-- Any path that ends a goal (app, admin, SQL) stops its pending notices.
create or replace function public.cancel_goal_whatsapp_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'active' and old.status is distinct from new.status then
    update public.goal_whatsapp_schedule
      set status = 'cancelled',
          error = 'Meta ' || new.status
      where goal_id = new.id
        and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_goals_cancel_whatsapp_schedule on public.payment_goals;
create trigger payment_goals_cancel_whatsapp_schedule
  after update of status on public.payment_goals
  for each row
  execute function public.cancel_goal_whatsapp_schedule();

insert into public.whatsapp_templates (name, kind, body, active)
values
  (
    'meta_vespera',
    'cobranca',
    'Lembrete: a reserva {{reserva}} da meta {{meta}} vence amanhã ({{data}}). Faça seu aporte para cumprir o prazo.',
    true
  ),
  (
    'meta_atraso',
    'cobranca',
    'A meta {{meta}} da reserva {{reserva}} está atrasada. O aporte de {{data}} ainda não foi feito.',
    true
  )
on conflict (name) do nothing;
