-- CPF, cidade, endereço e nascimento do cliente.
alter table public.profiles
  add column if not exists cpf text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists birth_date date;

comment on column public.profiles.cpf is 'CPF do cliente, só dígitos.';
comment on column public.profiles.city is 'Cidade do cliente.';
comment on column public.profiles.address is 'Endereço do cliente.';
comment on column public.profiles.birth_date is 'Data de nascimento do cliente.';
