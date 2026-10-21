-- Variante escolhida no catálogo (Cor / Armazenamento) gravada na reserva.
-- A reserva usa o preço da variante. Sem variante, nada muda (create_reservation de 2 args).

alter table public.reservations
  add column if not exists variant_id uuid references public.product_variants (id) on delete set null;

create index if not exists reservations_variant_id_idx on public.reservations (variant_id);

create or replace function public.create_reservation(
  p_product_id uuid,
  p_store_id uuid,
  p_variant_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_price integer;
  v_label text;
  v_id uuid;
begin
  if p_variant_id is null then
    return public.create_reservation(p_product_id, p_store_id);
  end if;

  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'É necessário estar autenticado para reservar.';
  end if;

  select v.price_cents,
         nullif(concat_ws(' · ', nullif(v.storage, ''), nullif(v.color, '')), '')
    into v_price, v_label
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = p_variant_id
    and v.product_id = p_product_id
    and v.active = true
    and p.active = true;

  if v_price is null then
    raise exception 'Produto indisponível ou inativo.';
  end if;

  if not exists (select 1 from public.stores s where s.id = p_store_id) then
    raise exception 'Loja inválida.';
  end if;

  insert into public.reservations (
    user_id, product_id, store_id, status, list_price_cents, amount_paid_cents, variant_id, notes
  ) values (
    v_uid, p_product_id, p_store_id, 'ativa', v_price, 0, p_variant_id,
    case when v_label is null then null else 'Variante: ' || v_label end
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_reservation(uuid, uuid, uuid) from public;
revoke all on function public.create_reservation(uuid, uuid, uuid) from anon;
grant execute on function public.create_reservation(uuid, uuid, uuid) to authenticated;

comment on function public.create_reservation(uuid, uuid, uuid) is
  'Cria reserva ativa com a variante (cor/armazenamento) e o preço dela. Sem variante usa create_reservation(uuid, uuid).';

-- Trocar de aparelho limpa a variante antiga.
create or replace function public.reservations_clear_variant_on_switch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.product_id is distinct from old.product_id then
    new.variant_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_clear_variant_on_switch on public.reservations;
create trigger reservations_clear_variant_on_switch
  before update of product_id on public.reservations
  for each row execute function public.reservations_clear_variant_on_switch();

-- ---------------------------------------------------------------------------
-- Hex da cor (products.color_hex / product_variants.color_hex), formato "#RRGGBB".
-- Admin escolhe no seletor; sem hex, o nome da cor define um valor (mesmo mapa de
-- src/lib/catalog/colors.ts). RLS inalterado: só admin escreve.
-- ---------------------------------------------------------------------------

alter table public.products add column if not exists color_hex text;
alter table public.product_variants add column if not exists color_hex text;

alter table public.products drop constraint if exists products_color_hex_format;
alter table public.products add constraint products_color_hex_format
  check (color_hex is null or color_hex ~ '^#[0-9A-F]{6}$');
alter table public.product_variants drop constraint if exists product_variants_color_hex_format;
alter table public.product_variants add constraint product_variants_color_hex_format
  check (color_hex is null or color_hex ~ '^#[0-9A-F]{6}$');

create or replace function public.color_hex_from_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_name is null or btrim(p_name) = '' then null
    when p_name ~* 'tit[aâ]nio\s*natural|natural' then '#BAB4A9'
    when p_name ~* 'tit[aâ]nio\s*preto|black\s*titanium' then '#3C3C3D'
    when p_name ~* 'tit[aâ]nio\s*branco|white\s*titanium' then '#F2F1ED'
    when p_name ~* 'tit[aâ]nio\s*deserto|deserto|desert' then '#BFA48F'
    when p_name ~* 'azul[\s-]*sierra|sierra' then '#9BB5CE'
    when p_name ~* 'meia[\s-]*noite|midnight' then '#232A31'
    when p_name ~* 'cinza[\s-]*espacial|space\s*gr[ae]y' then '#535150'
    when p_name ~* 'grafite|graphite' then '#41424C'
    when p_name ~* 'estelar|starlight' then '#F0E8DC'
    when p_name ~* 'lavanda|lavender' then '#C9B8E8'
    when p_name ~* 'product|vermelho|red' then '#BA0C2E'
    when p_name ~* 'preto|black|space' then '#1D1D1F'
    when p_name ~* 'branco|white' then '#F5F5F0'
    when p_name ~* 'prata|prateado|silver' then '#E3E4E5'
    when p_name ~* 'azul|blue|ultramar' then '#3D7EA6'
    when p_name ~* 'verde|green|teal' then '#ADC7B4'
    when p_name ~* 'rosa|pink' then '#F2C9CE'
    when p_name ~* 'roxo|purple' then '#B7A6D8'
    when p_name ~* 'amarelo|yellow' then '#F5E39A'
    when p_name ~* 'dourado|gold' then '#F4E3C1'
    when p_name ~* 'laranja|orange|c[oó]smico' then '#E07A3D'
    when p_name ~* 'tit[aâ]nio|titanium' then '#8D8D92'
    else null
  end;
$$;

update public.products
   set color_hex = public.color_hex_from_name(color)
 where color_hex is null and color is not null;
update public.product_variants
   set color_hex = public.color_hex_from_name(color)
 where color_hex is null and color is not null;

-- Importação por planilha e inserts sem hex: preenche pelo nome; hex minúsculo vira maiúsculo.
create or replace function public.fill_color_hex()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.color_hex is not null then
    new.color_hex := upper(new.color_hex);
  elsif new.color is not null then
    new.color_hex := public.color_hex_from_name(new.color);
  end if;
  return new;
end;
$$;

drop trigger if exists products_fill_color_hex on public.products;
create trigger products_fill_color_hex
  before insert or update of color, color_hex on public.products
  for each row execute function public.fill_color_hex();

drop trigger if exists product_variants_fill_color_hex on public.product_variants;
create trigger product_variants_fill_color_hex
  before insert or update of color, color_hex on public.product_variants
  for each row execute function public.fill_color_hex();
