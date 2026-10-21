-- iPlanet Pay · 037 · Saque: janela de 7 dias + saque do bônus de indicação via admin
--
-- Regra (Termos platform-v4, cláusula 11):
--   * Aportes Pix confirmados há 7 dias ou menos da solicitação → reembolso integral.
--   * Aportes confirmados há mais de 7 dias → desconto de withdrawal_fee_pct (padrão 30).
--   * Mesma fonte de taxa para saque de reserva e de carteira (app_settings.withdrawal_fee_pct).
--   * Bônus de indicação: só sai via solicitação aprovada pelo admin (Saques), sem taxa.
-- Nada aqui ignora RLS: RPCs security definer validam auth.uid() / current_user_role().

insert into public.app_settings (key, value) values
  ('withdrawal_full_refund_days', '7')
on conflict (key) do nothing;

alter table public.withdrawal_requests
  add column if not exists source text not null default 'reserva',
  add column if not exists full_refund_cents integer not null default 0,
  add column if not exists discounted_cents integer;

do $$ begin
  alter table public.withdrawal_requests
    add constraint withdrawal_requests_source_check
    check (source = any (array['reserva', 'carteira', 'bonus']));
exception when duplicate_object then null; end $$;

-- Histórico: saques de carteira eram marcados só por admin_notes = 'carteira'.
update public.withdrawal_requests set source = 'carteira'
 where source = 'reserva' and admin_notes = 'carteira';

-- Histórico: todo o valor era tratado como descontado.
update public.withdrawal_requests
   set discounted_cents = total_paid_cents - full_refund_cents
 where discounted_cents is null;

alter table public.withdrawal_requests alter column discounted_cents set default 0;
alter table public.withdrawal_requests alter column discounted_cents set not null;

do $$ begin
  alter table public.withdrawal_requests
    add constraint withdrawal_split_sum_check
    check (full_refund_cents >= 0 and discounted_cents >= 0
           and full_refund_cents + discounted_cents = total_paid_cents);
exception when duplicate_object then null; end $$;

-- Pendência única por reserva vale só para saque de reserva (carteira/bônus usam reserva âncora).
drop index if exists public.withdrawal_requests_pending_reservation_uidx;
create unique index if not exists withdrawal_requests_pending_reservation_uidx
  on public.withdrawal_requests (reservation_id)
  where status = 'pending' and source = 'reserva';
create unique index if not exists withdrawal_requests_pending_bonus_uidx
  on public.withdrawal_requests (user_id)
  where status = 'pending' and source = 'bonus';

-- ---------------------------------------------------------------------------
-- request_withdrawal (reserva) com janela de reembolso integral
-- ---------------------------------------------------------------------------
create or replace function public.request_withdrawal(
  p_reservation_id uuid,
  p_pix_key text,
  p_pix_key_type text,
  p_holder_full_name text,
  p_holder_cpf text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_status public.reservation_status;
  v_owner uuid;
  v_total integer;
  v_recent integer;
  v_discounted integer;
  v_window integer;
  v_fee_pct numeric;
  v_fee integer;
  v_refund integer;
  v_existing uuid;
  v_request_id uuid;
  v_cpf text;
  v_pix text;
  v_name text;
  v_type text;
  v_min_total integer;
  v_min_days integer;
  v_created timestamptz;
  v_now timestamptz := now();
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  v_pix := nullif(trim(p_pix_key), '');
  v_name := nullif(trim(p_holder_full_name), '');
  v_cpf := regexp_replace(coalesce(p_holder_cpf, ''), '\D', '', 'g');
  v_type := lower(trim(coalesce(p_pix_key_type, '')));

  if v_pix is null then raise exception 'Informe a chave Pix.'; end if;
  if v_name is null then raise exception 'Informe o nome completo do titular da chave.'; end if;
  if length(v_cpf) <> 11 then raise exception 'CPF do titular deve ter 11 dígitos.'; end if;
  if v_type is null or v_type not in ('cpf', 'cnpj', 'email', 'phone', 'random') then
    raise exception 'Tipo de chave Pix inválido.';
  end if;

  select created_at into v_created from public.profiles where id = v_user_id;
  v_min_days := public.get_setting_int('withdrawal_min_account_days', 15);
  if v_created is not null and v_created + (v_min_days || ' days')::interval > v_now then
    raise exception 'Saques liberados após % dias de conta ativa.', v_min_days;
  end if;

  select r.status, r.user_id into v_status, v_owner
  from public.reservations r where r.id = p_reservation_id for update;

  if v_status is null then raise exception 'Reserva não encontrada'; end if;
  if v_owner <> v_user_id then raise exception 'Reserva não pertence ao usuário'; end if;
  if v_status is distinct from 'ativa' then
    raise exception 'Apenas reservas ativas podem solicitar saque. Status: %.', v_status;
  end if;

  v_window := public.get_setting_int('withdrawal_full_refund_days', 7);

  select
    coalesce(sum(c.amount_cents), 0)::integer,
    coalesce(sum(c.amount_cents) filter (
      where coalesce(c.confirmed_at, c.created_at) >= v_now - (v_window || ' days')::interval
    ), 0)::integer
    into v_total, v_recent
  from public.contributions c
  where c.reservation_id = p_reservation_id and c.user_id = v_user_id and c.status = 'confirmed';

  if v_total <= 0 then raise exception 'Não há aportes confirmados para sacar'; end if;

  v_min_total := public.get_setting_int('withdrawal_min_total_cents', 100000);
  if v_total < v_min_total then
    raise exception 'Saque permitido apenas para aportes confirmados acima de R$ %.',
      (v_min_total / 100.0);
  end if;

  select id into v_existing from public.withdrawal_requests
  where reservation_id = p_reservation_id and status = 'pending' and source = 'reserva';
  if v_existing is not null then
    raise exception 'Já existe uma solicitação de saque pendente para esta reserva';
  end if;

  v_discounted := v_total - v_recent;
  v_fee_pct := public.get_setting_numeric('withdrawal_fee_pct', 30);
  v_fee := round(v_discounted::numeric * (v_fee_pct / 100.0))::integer;
  v_refund := v_total - v_fee;

  insert into public.withdrawal_requests (
    user_id, reservation_id, source, total_paid_cents, full_refund_cents, discounted_cents,
    fee_percentage, fee_amount_cents, refund_amount_cents,
    pix_key, pix_key_type, holder_full_name, holder_cpf, status, payout_status
  ) values (
    v_user_id, p_reservation_id, 'reserva', v_total, v_recent, v_discounted,
    v_fee_pct, v_fee, v_refund,
    v_pix, v_type, v_name, v_cpf, 'pending', 'pending_admin'
  ) returning id into v_request_id;

  update public.reservations set status = 'saque_pendente', updated_at = now()
  where id = p_reservation_id;

  update public.contributions set status = 'expired', updated_at = now()
  where reservation_id = p_reservation_id and status = 'pending';

  return v_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- request_bonus_withdrawal: bônus de indicação só sai com aprovação do admin
-- ---------------------------------------------------------------------------
create or replace function public.request_bonus_withdrawal(
  p_pix_key text,
  p_pix_key_type text,
  p_holder_full_name text,
  p_holder_cpf text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance integer;
  v_created timestamptz;
  v_min_days integer;
  v_anchor uuid;
  v_id uuid;
  v_cpf text := regexp_replace(coalesce(p_holder_cpf, ''), '\D', '', 'g');
  v_pix text := nullif(trim(p_pix_key), '');
  v_name text := nullif(trim(p_holder_full_name), '');
  v_type text := lower(trim(coalesce(p_pix_key_type, '')));
begin
  if v_user is null then raise exception 'Não autenticado'; end if;
  if v_pix is null then raise exception 'Informe a chave Pix.'; end if;
  if v_name is null then raise exception 'Informe o nome completo do titular da chave.'; end if;
  if length(v_cpf) <> 11 then raise exception 'CPF do titular deve ter 11 dígitos.'; end if;
  if v_type not in ('cpf', 'cnpj', 'email', 'phone', 'random') then
    raise exception 'Tipo de chave Pix inválido.';
  end if;

  select created_at, referral_bonus_balance_cents into v_created, v_balance
  from public.profiles where id = v_user for update;
  v_min_days := public.get_setting_int('withdrawal_min_account_days', 15);
  if v_created is not null and v_created + (v_min_days || ' days')::interval > now() then
    raise exception 'Saques liberados após % dias de conta ativa.', v_min_days;
  end if;
  if coalesce(v_balance, 0) <= 0 then raise exception 'Sem bônus disponível'; end if;

  if exists (select 1 from public.withdrawal_requests
             where user_id = v_user and source = 'bonus' and status = 'pending') then
    raise exception 'Já existe um saque de bônus pendente';
  end if;

  select id into v_anchor from public.reservations
  where user_id = v_user order by created_at desc limit 1;
  if v_anchor is null then
    raise exception 'É preciso ter uma reserva para registrar o saque.';
  end if;

  -- Retém o bônus enquanto o admin analisa.
  update public.profiles
     set referral_bonus_balance_cents = referral_bonus_balance_cents - v_balance
   where id = v_user;

  insert into public.withdrawal_requests (
    user_id, reservation_id, source, total_paid_cents, full_refund_cents, discounted_cents,
    fee_percentage, fee_amount_cents, refund_amount_cents,
    pix_key, pix_key_type, holder_full_name, holder_cpf, status, payout_status, admin_notes
  ) values (
    v_user, v_anchor, 'bonus', v_balance, v_balance, 0,
    0, 0, v_balance,
    v_pix, v_type, v_name, v_cpf, 'pending', 'pending_admin', 'bônus de indicação'
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.request_bonus_withdrawal(text, text, text, text) from public, anon;
grant execute on function public.request_bonus_withdrawal(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- process_withdrawal: só mexe na reserva quando o saque é de reserva;
-- rejeitar saque de bônus devolve o bônus.
-- ---------------------------------------------------------------------------
create or replace function public.process_withdrawal(
  p_request_id uuid,
  p_action text,
  p_admin_notes text default null,
  p_payout_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.withdrawal_requests%rowtype;
  v_action text;
  v_payout text;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Acesso negado';
  end if;

  v_action := lower(trim(p_action));
  if v_action not in ('approve', 'reject') then
    raise exception 'Ação inválida. Use approve ou reject';
  end if;

  select * into v_req from public.withdrawal_requests where id = p_request_id for update;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  if v_req.status is distinct from 'pending' then raise exception 'Solicitação já processada'; end if;

  if v_action = 'approve' then
    v_payout := coalesce(nullif(trim(p_payout_status), ''), 'pending_gateway');
    if v_payout not in ('pending_gateway', 'queued', 'sent', 'failed') then
      raise exception 'payout_status inválido';
    end if;

    update public.withdrawal_requests
       set status = 'approved', payout_status = v_payout,
           admin_notes = coalesce(p_admin_notes, admin_notes),
           processed_at = now(), processed_by = auth.uid(),
           password_confirmed_at = now(), updated_at = now()
     where id = p_request_id;

    if v_req.source = 'reserva' then
      update public.reservations set status = 'sacada', updated_at = now()
       where id = v_req.reservation_id and status = 'saque_pendente';
    end if;

    return jsonb_build_object(
      'ok', true, 'action', 'approve', 'request_id', p_request_id,
      'reservation_id', v_req.reservation_id, 'source', v_req.source,
      'refund_amount_cents', v_req.refund_amount_cents, 'payout_status', v_payout
    );
  end if;

  update public.withdrawal_requests
     set status = 'rejected', payout_status = 'pending_admin',
         admin_notes = coalesce(p_admin_notes, admin_notes),
         processed_at = now(), processed_by = auth.uid(),
         password_confirmed_at = now(), updated_at = now()
   where id = p_request_id;

  if v_req.source = 'reserva' then
    update public.reservations set status = 'ativa', updated_at = now()
     where id = v_req.reservation_id and status = 'saque_pendente';
  elsif v_req.source = 'bonus' then
    update public.profiles
       set referral_bonus_balance_cents = referral_bonus_balance_cents + v_req.total_paid_cents
     where id = v_req.user_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'action', 'reject', 'request_id', p_request_id,
    'reservation_id', v_req.reservation_id, 'source', v_req.source
  );
end;
$$;

revoke all on function public.process_withdrawal(uuid, text, text, text) from public, anon;
grant execute on function public.process_withdrawal(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_withdrawal_by_user: devolve bônus retido; reserva só se for de reserva
-- ---------------------------------------------------------------------------
create or replace function public.cancel_withdrawal_by_user(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.withdrawal_requests%rowtype;
begin
  select * into v_req from public.withdrawal_requests
  where id = p_request_id and user_id = auth.uid() for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if v_req.status is distinct from 'pending' then
    raise exception 'Só é possível cancelar saques pendentes.';
  end if;

  update public.withdrawal_requests
     set status = 'cancelled', processed_at = now(), updated_at = now()
   where id = p_request_id;

  if v_req.source = 'reserva' then
    update public.reservations set status = 'ativa', updated_at = now()
     where id = v_req.reservation_id and status = 'saque_pendente';
  elsif v_req.source = 'bonus' then
    update public.profiles
       set referral_bonus_balance_cents = referral_bonus_balance_cents + v_req.total_paid_cents
     where id = v_req.user_id;
  end if;
end;
$$;
