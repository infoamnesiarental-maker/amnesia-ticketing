-- Checkout Pro global (cuenta de la plataforma) — PASO 2/2
-- ANTES: ejecutá supabase/mp-checkout-global-1-enum.sql y esperá Success.
-- Motivo: Postgres no permite usar un enum nuevo en la misma transacción (55P04).
-- Ejecutar en Supabase SQL Editor después de add-promo-whatsapp.sql / attendees-per-ticket.sql.

-- -----------------------------------------------------------------------------
-- 1) Setting global (una sola fila)
-- -----------------------------------------------------------------------------
create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  mp_checkout_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.platform_settings (id, mp_checkout_enabled)
values (1, false)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings_select_authenticated" on public.platform_settings;
create policy "platform_settings_select_authenticated"
  on public.platform_settings
  for select
  to authenticated, anon
  using (true);

comment on table public.platform_settings is 'Configuración global de la ticketera. Escritura solo con service_role.';

-- -----------------------------------------------------------------------------
-- 2) Columnas MP en orders
-- -----------------------------------------------------------------------------
alter table public.orders
  add column if not exists mp_preference_id text,
  add column if not exists checkout_expires_at timestamptz;

create unique index if not exists orders_mp_preference_id_unique
  on public.orders (mp_preference_id)
  where mp_preference_id is not null;

create unique index if not exists orders_mp_payment_id_unique
  on public.orders (mp_payment_id)
  where mp_payment_id is not null;

create index if not exists orders_awaiting_payment_expires_idx
  on public.orders (checkout_expires_at)
  where status = 'awaiting_payment';

-- -----------------------------------------------------------------------------
-- 3) ¿Esta orden reserva stock?
--    awaiting_payment solo reserva mientras no venció la preferencia.
-- -----------------------------------------------------------------------------
create or replace function public.order_reserves_stock(
  p_status public.order_status,
  p_checkout_expires_at timestamptz
) returns boolean
language sql
stable
as $$
  select
    p_status in (
      'pending_validation'::public.order_status,
      'validated'::public.order_status,
      'manual_review'::public.order_status
    )
    or (
      p_status = 'awaiting_payment'::public.order_status
      and (p_checkout_expires_at is null or p_checkout_expires_at > now())
    );
$$;

grant execute on function public.order_reserves_stock(public.order_status, timestamptz) to anon, authenticated, service_role;

create or replace function public.release_benefit_code_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.benefit_campaign_codes') is null then
    return;
  end if;

  update public.benefit_campaign_codes
    set
      status = 'pending',
      used_order_id = null,
      used_at = null
    where used_order_id = p_order_id
      and status = 'used';
end;
$$;

revoke all on function public.release_benefit_code_for_order(uuid) from public;
grant execute on function public.release_benefit_code_for_order(uuid) to service_role;

create or replace function public.expire_stale_mp_checkout_orders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_n int := 0;
begin
  select coalesce(array_agg(id), '{}') into v_ids
  from public.orders
  where status = 'awaiting_payment'::public.order_status
    and checkout_expires_at is not null
    and checkout_expires_at < now();

  if cardinality(v_ids) = 0 then
    return 0;
  end if;

  update public.orders
    set
      status = 'cancelled'::public.order_status,
      rejected_at = coalesce(rejected_at, now())
    where id = any (v_ids)
      and status = 'awaiting_payment'::public.order_status;

  get diagnostics v_n = row_count;

  perform public.release_benefit_code_for_order(x)
  from unnest(v_ids) as x;

  return v_n;
end;
$$;

revoke all on function public.expire_stale_mp_checkout_orders() from public;
grant execute on function public.expire_stale_mp_checkout_orders() to service_role;

-- -----------------------------------------------------------------------------
-- 4) Ticketera pública: flag + stock con awaiting_payment no vencido
-- -----------------------------------------------------------------------------
create or replace function public.get_ticketera_data(p_org_slug text, p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  r jsonb;
begin
  select jsonb_build_object(
    'organization', jsonb_build_object(
      'slug', o.slug,
      'name', o.name
    ),
    'event', jsonb_build_object(
      'id', e.id,
      'slug', e.slug,
      'name', e.name,
      'place', e.place,
      'starts_at', e.starts_at,
      'mp_alias', e.mp_alias,
      'cover_image_url', e.cover_image_url,
      'promo_whatsapp', e.promo_whatsapp
    ),
    'mp_checkout_enabled', coalesce(
      (select s.mp_checkout_enabled from public.platform_settings s where s.id = 1),
      false
    ),
    'ticket_types', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', tt.id,
            'slug', tt.slug,
            'name', tt.name,
            'description', tt.description,
            'price_ars', tt.price_ars,
            'available_qty', (
              greatest(
                0::bigint,
                tt.stock_total::bigint - coalesce(
                  (
                    select sum(oi.qty)::bigint
                    from public.order_items oi
                    join public.orders ord on ord.id = oi.order_id
                    where oi.ticket_type_id = tt.id
                      and public.order_reserves_stock(ord.status, ord.checkout_expires_at)
                  ),
                  0::bigint
                )
              )
            )::int
          )
          order by tt.created_at
        )
        from public.ticket_types tt
        where tt.event_id = e.id
          and tt.is_active = true
          and (tt.sales_ends_at is null or tt.sales_ends_at > now())
          and tt.stock_total > coalesce(
            (
              select sum(oi.qty)::bigint
              from public.order_items oi
              join public.orders ord on ord.id = oi.order_id
              where oi.ticket_type_id = tt.id
                and public.order_reserves_stock(ord.status, ord.checkout_expires_at)
            ),
            0::bigint
          )
      ),
      '[]'::jsonb
    )
  )
  into r
  from public.events e
  join public.organizations o on o.id = e.organization_id
  where o.slug = p_org_slug
    and e.slug = p_event_slug
    and o.status = 'approved'::public.organization_status;

  return r;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) Catálogo home: mismo criterio de stock
-- -----------------------------------------------------------------------------
create or replace function public.list_public_events_catalog()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'org_slug', ev.org_slug,
        'org_name', ev.org_name,
        'event_slug', ev.event_slug,
        'event_name', ev.event_name,
        'place', ev.place,
        'starts_at', ev.starts_at,
        'cover_image_url', ev.cover_image_url,
        'catalog_flair', ev.catalog_flair,
        'description_preview', ev.description_preview,
        'from_price_ars', ev.from_price_ars,
        'to_price_ars', ev.to_price_ars,
        'tickets_available', ev.tickets_available
      )
      order by ev.starts_at nulls last, ev.event_name
    ),
    '[]'::jsonb
  )
  from (
    select
      o.slug as org_slug,
      o.name as org_name,
      e.slug as event_slug,
      e.name as event_name,
      e.place,
      e.starts_at,
      e.cover_image_url,
      nullif(trim(e.catalog_flair), '') as catalog_flair,
      case
        when length(trim(coalesce(e.description, ''))) > 0 then left(trim(e.description), 200)
        else null
      end as description_preview,
      (
        select min(tt.price_ars)
        from public.ticket_types tt
        where tt.event_id = e.id
          and tt.is_active = true
          and (tt.sales_ends_at is null or tt.sales_ends_at > now())
          and tt.stock_total > coalesce(
            (
              select sum(oi.qty)::bigint
              from public.order_items oi
              join public.orders ord on ord.id = oi.order_id
              where oi.ticket_type_id = tt.id
                and public.order_reserves_stock(ord.status, ord.checkout_expires_at)
            ),
            0
          )
      ) as from_price_ars,
      (
        select max(tt.price_ars)
        from public.ticket_types tt
        where tt.event_id = e.id
          and tt.is_active = true
          and (tt.sales_ends_at is null or tt.sales_ends_at > now())
          and tt.stock_total > coalesce(
            (
              select sum(oi.qty)::bigint
              from public.order_items oi
              join public.orders ord on ord.id = oi.order_id
              where oi.ticket_type_id = tt.id
                and public.order_reserves_stock(ord.status, ord.checkout_expires_at)
            ),
            0
          )
      ) as to_price_ars,
      (
        select coalesce(
          sum(
            greatest(
              0::bigint,
              tt.stock_total::bigint - coalesce(
                (
                  select sum(oi.qty)::bigint
                  from public.order_items oi
                  join public.orders ord on ord.id = oi.order_id
                  where oi.ticket_type_id = tt.id
                    and public.order_reserves_stock(ord.status, ord.checkout_expires_at)
                ),
                0
              )
            )
          )::int,
          0
        )
        from public.ticket_types tt
        where tt.event_id = e.id
          and tt.is_active = true
          and (tt.sales_ends_at is null or tt.sales_ends_at > now())
      ) as tickets_available
    from public.events e
    join public.organizations o on o.id = e.organization_id
    where o.status = 'approved'::public.organization_status
  ) ev
  where ev.from_price_ars is not null;
$$;

grant execute on function public.list_public_events_catalog() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6) Emisión de tickets: aceptar awaiting_payment
-- -----------------------------------------------------------------------------
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
  v_attendee record;
  v_pos int := 0;
  v_has_attendees boolean;
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
    'manual_review'::public.order_status,
    'awaiting_payment'::public.order_status
  ) then
    raise exception 'order not finalizable from status %', v_ord.status;
  end if;

  select coalesce(sum(oi.qty), 0)::int into v_items_sum
  from public.order_items oi
  where oi.order_id = p_order_id;

  if v_items_sum <> coalesce(v_ord.total_qty, 0) then
    raise exception 'order_items qty sum (%) does not match orders.total_qty (%)', v_items_sum, v_ord.total_qty;
  end if;

  select exists(select 1 from public.attendees a where a.order_id = p_order_id) into v_has_attendees;
  if v_has_attendees then
    select count(*)::int into v_existing from public.attendees where order_id = p_order_id;
    if v_existing <> coalesce(v_ord.total_qty, 0) then
      raise exception 'attendees count (%) does not match orders.total_qty (%)', v_existing, v_ord.total_qty;
    end if;
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

    v_pos := v_pos + 1;

    if v_has_attendees then
      select id, first_name, last_name, dni, phone, is_buyer
        into v_attendee
        from public.attendees
        where order_id = p_order_id and position = v_pos;
    else
      v_attendee := null;
    end if;

    v_uid := replace(gen_random_uuid()::text, '-', '');

    v_payload := jsonb_build_object(
      'schema_version', 2,
      'order_id', p_order_id,
      'event_id', v_ord.event_id,
      'ticket_type_id', v_tt_id,
      'unit_price_ars', v_unit,
      'position', v_pos,
      'attendee', case
        when v_attendee.id is null then jsonb_build_object(
          'first_name', v_ord.buyer_first_name,
          'last_name', v_ord.buyer_last_name,
          'dni', v_ord.buyer_dni,
          'phone', v_ord.buyer_phone,
          'is_buyer', true
        )
        else jsonb_build_object(
          'first_name', v_attendee.first_name,
          'last_name', v_attendee.last_name,
          'dni', v_attendee.dni,
          'phone', v_attendee.phone,
          'is_buyer', v_attendee.is_buyer
        )
      end,
      'buyer_email', v_ord.buyer_email,
      'actor', jsonb_build_object(
        'type', p_actor,
        'user_id', p_actor_user_id
      )
    );

    insert into public.tickets (event_id, order_id, ticket_type_id, attendee_id, uid, payload)
    values (v_ord.event_id, p_order_id, v_tt_id, v_attendee.id, v_uid, v_payload);

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

-- Rechazar también libera códigos de beneficio (checkout abandonado / rechazo).
create or replace function public.reject_order(
  p_order_id uuid,
  p_actor text,
  p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ord record;
begin
  if p_order_id is null then
    raise exception 'order_id required';
  end if;
  if p_actor is null or btrim(p_actor) = '' then
    raise exception 'actor required';
  end if;

  select id, status into v_ord from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;

  if v_ord.status = 'rejected'::public.order_status then
    return jsonb_build_object('ok', true, 'idempotent', true, 'order_id', p_order_id);
  end if;
  if v_ord.status = 'validated'::public.order_status then
    raise exception 'cannot reject a validated order';
  end if;

  update public.orders
    set status = 'rejected'::public.order_status,
        rejected_at = now()
    where id = p_order_id;

  perform public.release_benefit_code_for_order(p_order_id);

  return jsonb_build_object('ok', true, 'idempotent', false, 'order_id', p_order_id);
end;
$$;

revoke all on function public.reject_order(uuid, text, uuid) from public;
grant execute on function public.reject_order(uuid, text, uuid) to service_role;

notify pgrst, 'reload schema';
