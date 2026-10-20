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
