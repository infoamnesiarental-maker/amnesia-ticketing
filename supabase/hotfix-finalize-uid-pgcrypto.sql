-- HOTFIX: error "function gen_random_bytes(integer) does not exist"
-- Causa: pgcrypto no resuelve por search_path en algunos proyectos Supabase.
-- Solución: usar gen_random_uuid() que es core de Postgres 13+, no requiere extensión externa.

create or replace function public.finalize_order_payment(
  p_order_id uuid,
  p_mp_payment_id text,
  p_actor text,
  p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ord record;
  v_existing int;
  v_needed int;
  v_items_sum int;
  v_inserted int := 0;
  v_tt_id uuid;
  v_unit numeric(12,2);
  v_n int;
  v_uid text;
  v_payload jsonb;
begin
  if p_order_id is null then
    raise exception 'order_id required';
  end if;

  if p_actor is null or btrim(p_actor) = '' then
    raise exception 'actor required';
  end if;

  select
    o.id,
    o.event_id,
    o.status,
    o.total_qty,
    o.buyer_first_name,
    o.buyer_last_name,
    o.buyer_dni,
    o.buyer_phone,
    o.buyer_email
  into v_ord
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  if v_ord.status = 'validated'::public.order_status then
    select count(*)::int into v_existing from public.tickets t where t.order_id = p_order_id;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'order_id', p_order_id,
      'status', v_ord.status,
      'tickets_existing', v_existing
    );
  end if;

  if v_ord.status not in (
    'pending_validation'::public.order_status,
    'manual_review'::public.order_status
  ) then
    raise exception 'order not finalizable from status %', v_ord.status;
  end if;

  select coalesce(sum(oi.qty), 0)::int into v_items_sum
  from public.order_items oi
  where oi.order_id = p_order_id;

  if v_items_sum <> coalesce(v_ord.total_qty, 0) then
    raise exception 'order_items qty sum (%) does not match orders.total_qty (%)', v_items_sum, v_ord.total_qty;
  end if;

  select count(*)::int into v_existing from public.tickets t where t.order_id = p_order_id;
  v_needed := coalesce(v_ord.total_qty, 0);

  if v_existing > 0 and v_existing < v_needed then
    raise exception 'partial tickets already exist for order % (existing %, needed %)', p_order_id, v_existing, v_needed;
  end if;

  for v_tt_id, v_unit, v_n in
    with expanded as (
      select
        oi.ticket_type_id,
        oi.unit_price_ars,
        gs.n
      from public.order_items oi
      cross join lateral generate_series(1, oi.qty) as gs(n)
      where oi.order_id = p_order_id
    )
    select ticket_type_id, unit_price_ars, n
    from expanded
    order by ticket_type_id, n
  loop
    if v_inserted + v_existing >= v_needed then
      exit;
    end if;

    -- UID = uuid v4 sin guiones (32 chars hex). Core de Postgres, no requiere pgcrypto.
    v_uid := replace(gen_random_uuid()::text, '-', '');

    v_payload := jsonb_build_object(
      'schema_version', 1,
      'order_id', p_order_id,
      'event_id', v_ord.event_id,
      'ticket_type_id', v_tt_id,
      'unit_price_ars', v_unit,
      'buyer', jsonb_build_object(
        'first_name', v_ord.buyer_first_name,
        'last_name', v_ord.buyer_last_name,
        'dni', v_ord.buyer_dni,
        'phone', v_ord.buyer_phone,
        'email', v_ord.buyer_email
      ),
      'actor', jsonb_build_object(
        'type', p_actor,
        'user_id', p_actor_user_id
      )
    );

    insert into public.tickets (event_id, order_id, ticket_type_id, uid, payload)
    values (v_ord.event_id, p_order_id, v_tt_id, v_uid, v_payload);

    v_inserted := v_inserted + 1;
  end loop;

  update public.orders
    set
      status = 'validated'::public.order_status,
      mp_payment_id = coalesce(nullif(btrim(p_mp_payment_id), ''), mp_payment_id),
      validated_at = now()
    where id = p_order_id;

  select count(*)::int into v_existing from public.tickets t where t.order_id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'order_id', p_order_id,
    'status', 'validated',
    'tickets_inserted', v_inserted,
    'tickets_total', v_existing
  );
end;
$$;

revoke all on function public.finalize_order_payment(uuid, text, text, uuid) from public;
grant execute on function public.finalize_order_payment(uuid, text, text, uuid) to service_role;
