-- Avisos da plataforma e cupons pré-criados para disparo.

create table if not exists public.platform_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_notices (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pendencia', 'recado', 'sorteio', 'ganhador', 'cupom')),
  title text not null,
  body text not null,
  coupon_code text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists platform_notices_created_at_idx
  on public.platform_notices (created_at desc);

create table if not exists public.platform_notice_reads (
  notice_id uuid not null references public.platform_notices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);

alter table public.platform_coupons enable row level security;
alter table public.platform_notices enable row level security;
alter table public.platform_notice_reads enable row level security;

create policy platform_coupons_admin on public.platform_coupons
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy platform_notices_read on public.platform_notices
  for select to authenticated
  using (true);

create policy platform_notices_admin on public.platform_notices
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy platform_notice_reads_own on public.platform_notice_reads
  for select to authenticated
  using (user_id = auth.uid());

create policy platform_notice_reads_insert_own on public.platform_notice_reads
  for insert to authenticated
  with check (user_id = auth.uid());

create policy platform_notice_reads_update_own on public.platform_notice_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
