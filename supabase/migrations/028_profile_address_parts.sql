-- Número e UF separados no endereço do cliente.
alter table public.profiles
  add column if not exists address_number text,
  add column if not exists state text;

comment on column public.profiles.address_number is 'Número do endereço.';
comment on column public.profiles.state is 'UF do endereço (ex.: SP).';
