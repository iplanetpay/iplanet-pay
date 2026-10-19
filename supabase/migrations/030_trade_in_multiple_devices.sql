-- iPlanet Pay · vários usados por reserva + estado da bateria
--
-- Cada linha de used_device_offers continua sendo UM aparelho, avaliado
-- individualmente por review_used_device_offer (crédito somado à reserva).
-- Remove a regra "uma solicitação pendente por reserva" e passa a receber
-- vários aparelhos de uma vez, de forma atômica.

alter table public.used_device_offers
  add column if not exists battery_health_pct integer,
  add column if not exists battery_health_reason text;

alter table public.used_device_offers
  drop constraint if exists used_device_offers_battery_pct_range,
  drop constraint if exists used_device_offers_battery_reason_valid,
  drop constraint if exists used_device_offers_battery_one_answer;

alter table public.used_device_offers
  add constraint used_device_offers_battery_pct_range
    check (battery_health_pct is null or battery_health_pct between 0 and 100),
  add constraint used_device_offers_battery_reason_valid
    check (battery_health_reason is null or battery_health_reason in ('unknown', 'not_applicable')),
  -- Linhas anteriores à 030 não têm resposta; a obrigatoriedade fica na RPC.
  add constraint used_device_offers_battery_one_answer
    check (battery_health_pct is null or battery_health_reason is null);

comment on column public.used_device_offers.battery_health_pct is
  'Saúde da bateria informada pelo cliente (0–100%).';
comment on column public.used_device_offers.battery_health_reason is
  'Quando não há porcentagem: unknown (Não sei) ou not_applicable (aparelho sem indicador).';

create index if not exists used_device_offers_reservation_imei_idx
  on public.used_device_offers (reservation_id, imei);

-- ---------------------------------------------------------------------------
-- create_used_device_offers — cliente envia 1..5 aparelhos para a reserva
-- p_devices: [{ id, device_model, imei, expected_value_cents, minimum_value_cents,
--   maintenance_options[], liquid_exposure, photo_paths[],
--   battery_health_pct | battery_health_reason }]
-- ---------------------------------------------------------------------------

create or replace function public.create_used_device_offers(
  p_reservation_id uuid,
  p_devices jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_devices constant integer := 5;
  v_uid uuid;
  v_res public.reservations%rowtype;
  v_count integer;
  v_live integer;
  v_dev jsonb;
  v_idx integer := 0;
  v_label text;
  v_id uuid;
  v_model text;
  v_imei text;
  v_expected integer;
  v_minimum integer;
  v_maintenance text[];
  v_photos text[];
  v_path text;
  v_prefix text;
  v_pct_raw text;
  v_pct integer;
  v_reason text;
  v_imeis text[] := '{}';
  v_ids uuid[] := '{}';
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'É necessário estar autenticado.';
  end if;

  if p_devices is null or jsonb_typeof(p_devices) <> 'array' then
    raise exception 'Informe ao menos um aparelho.';
  end if;

  v_count := jsonb_array_length(p_devices);
  if v_count = 0 then
    raise exception 'Informe ao menos um aparelho.';
  end if;

  select * into v_res
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_res.user_id <> v_uid then
    raise exception 'Acesso negado.';
  end if;

  if v_res.status <> 'ativa' then
    raise exception 'Só reservas ativas aceitam oferta de usado.';
  end if;

  select count(*) into v_live
  from public.used_device_offers o
  where o.reservation_id = p_reservation_id
    and (
      o.status = 'pending'
      or (o.status = 'approved' and coalesce(o.admin_message, '') !~ '^(DESCARTADA|EXPIRADA)\|')
    );

  if v_live + v_count > c_max_devices then
    raise exception 'Limite de % aparelhos em avaliação ou aprovados por reserva.', c_max_devices;
  end if;

  for v_dev in select value from jsonb_array_elements(p_devices) loop
    v_idx := v_idx + 1;
    v_label := case when v_count > 1 then 'Aparelho ' || v_idx || ': ' else '' end;

    v_id := nullif(v_dev->>'id', '')::uuid;
    if v_id is null then
      raise exception '%Identificador da oferta inválido.', v_label;
    end if;

    v_model := trim(coalesce(v_dev->>'device_model', ''));
    v_imei := regexp_replace(coalesce(v_dev->>'imei', ''), '\s', '', 'g');
    if v_model = '' or v_imei = '' then
      raise exception '%Preencha modelo e IMEI.', v_label;
    end if;

    if v_imei = any(v_imeis) then
      raise exception '%IMEI repetido no envio.', v_label;
    end if;
    v_imeis := v_imeis || v_imei;

    if exists (
      select 1
      from public.used_device_offers o
      where o.reservation_id = p_reservation_id
        and o.imei = v_imei
        and (
          o.status = 'pending'
          or (o.status = 'approved' and coalesce(o.admin_message, '') !~ '^(DESCARTADA|EXPIRADA)\|')
        )
    ) then
      raise exception '%Este IMEI já está em avaliação ou aprovado nesta reserva.', v_label;
    end if;

    v_expected := case when (v_dev->>'expected_value_cents') ~ '^\d{1,9}$'
      then (v_dev->>'expected_value_cents')::integer end;
    v_minimum := case when (v_dev->>'minimum_value_cents') ~ '^\d{1,9}$'
      then (v_dev->>'minimum_value_cents')::integer end;
    if coalesce(v_expected, 0) <= 0 or coalesce(v_minimum, 0) <= 0 then
      raise exception '%Informe valores esperado e mínimo válidos.', v_label;
    end if;
    if v_minimum > v_expected then
      raise exception '%O valor mínimo não pode ser maior que o esperado.', v_label;
    end if;

    v_maintenance := case when jsonb_typeof(v_dev->'maintenance_options') = 'array'
      then array(select jsonb_array_elements_text(v_dev->'maintenance_options'))
      else '{}'::text[] end;
    if coalesce(array_length(v_maintenance, 1), 0) = 0 then
      raise exception '%Selecione ao menos uma opção de manutenção.', v_label;
    end if;

    if jsonb_typeof(v_dev->'liquid_exposure') <> 'boolean' then
      raise exception '%Selecione Sim ou Não para exposição a líquidos.', v_label;
    end if;

    v_pct_raw := nullif(trim(coalesce(v_dev->>'battery_health_pct', '')), '');
    v_reason := nullif(trim(coalesce(v_dev->>'battery_health_reason', '')), '');
    if v_reason is not null then
      if v_reason not in ('unknown', 'not_applicable') or v_pct_raw is not null then
        raise exception '%Estado da bateria inválido.', v_label;
      end if;
      v_pct := null;
    else
      if v_pct_raw is null then
        raise exception '%Informe o estado da bateria.', v_label;
      end if;
      if v_pct_raw !~ '^\d{1,3}$' or v_pct_raw::integer > 100 then
        raise exception '%O estado da bateria deve ser um número inteiro entre 0 e 100.', v_label;
      end if;
      v_pct := v_pct_raw::integer;
    end if;

    v_photos := case when jsonb_typeof(v_dev->'photo_paths') = 'array'
      then array(select jsonb_array_elements_text(v_dev->'photo_paths'))
      else '{}'::text[] end;
    if coalesce(array_length(v_photos, 1), 0) = 0 then
      raise exception '%Envie ao menos uma foto do aparelho.', v_label;
    end if;

    v_prefix := v_uid::text || '/' || v_id::text || '/';
    foreach v_path in array v_photos loop
      if v_path is null or left(v_path, length(v_prefix)) <> v_prefix then
        raise exception '%Caminho de foto inválido.', v_label;
      end if;
    end loop;

    insert into public.used_device_offers (
      id,
      user_id,
      reservation_id,
      device_model,
      imei,
      expected_value_cents,
      minimum_value_cents,
      maintenance_options,
      liquid_exposure,
      photo_paths,
      battery_health_pct,
      battery_health_reason,
      status
    ) values (
      v_id,
      v_uid,
      p_reservation_id,
      v_model,
      v_imei,
      v_expected,
      v_minimum,
      v_maintenance,
      (v_dev->>'liquid_exposure')::boolean,
      v_photos,
      v_pct,
      v_reason,
      'pending'
    );

    v_ids := v_ids || v_id;
  end loop;

  return v_ids;
end;
$$;

revoke all on function public.create_used_device_offers(uuid, jsonb) from public, anon;
grant execute on function public.create_used_device_offers(uuid, jsonb) to authenticated;
