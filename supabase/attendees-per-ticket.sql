-- ATTENDEES POR ENTRADA: 1 fila por ticket (comprador + acompañantes)
-- Permite tener una lista nominal real, no solo del comprador.
-- Ejecutar en Supabase SQL Editor (proyecto Amnesia Rental ticketera).

-- -----------------------------------------------------------------------------
-- 1) Tabla attendees
-- -----------------------------------------------------------------------------
create table if not exists public.attendees (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  position int not null check (position >= 1),
  first_name text not null check (length(btrim(first_name)) between 1 and 80),
  last_name text not null check (length(btrim(last_name)) between 1 and 80),
  dni text not null check (length(btrim(dni)) between 4 and 32),
  phone text,
  is_buyer boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, position)
);

create index if not exists idx_attendees_order on public.attendees(order_id);
create index if not exists idx_attendees_dni on public.attendees(dni);

alter table public.attendees enable row level security;
-- Sin políticas: solo service_role accede (escrituras desde server actions).

-- -----------------------------------------------------------------------------
-- 2) Tickets: link opcional a attendee (legacy puede ser null)
-- -----------------------------------------------------------------------------
alter table public.tickets
  add column if not exists attendee_id uuid references public.attendees(id);

create index if not exists idx_tickets_attendee on public.tickets(attendee_id);

-- -----------------------------------------------------------------------------
-- 3) RPC finalize_order_payment: ahora asocia cada ticket a un attendee.
-- Si una orden vieja no tiene attendees, sigue funcionando (attendee_id queda null).
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

  -- Verificar si la orden tiene attendees (flujo nuevo). Si tiene, deben ser exactamente N.
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

    -- Buscar attendee correspondiente (por position). Si no hay, queda null.
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

-- -----------------------------------------------------------------------------
-- 4) Lista pública de invitados: ahora 1 fila por entrada (no por orden).
--    Si hay attendees, los devuelve. Si la orden es vieja (sin attendees),
--    expande total_qty con el comprador.
-- -----------------------------------------------------------------------------
-- Borrar versiones previas (firma de retorno cambió: ya no se puede CREATE OR REPLACE)
drop function if exists public.get_event_attendees(text, text);
drop function if exists public.get_event_attendees_admin(uuid);

create or replace function public.get_event_attendees(
  p_org_slug text,
  p_event_slug text
) returns table (
  first_name text,
  last_name text,
  dni text,
  status text,
  is_buyer boolean,
  attendee_position int,
  order_id uuid,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with ev as (
    select e.id as event_id
    from public.events e
    join public.organizations org on org.id = e.organization_id
    where org.slug = p_org_slug
      and e.slug = p_event_slug
      and org.status = 'approved'
    limit 1
  ),
  ord as (
    select o.*
    from public.orders o
    join ev on ev.event_id = o.event_id
    where o.status in ('validated','manual_review','pending_validation')
  ),
  -- attendees reales (flujo nuevo)
  real_att as (
    select
      a.first_name,
      a.last_name,
      a.dni,
      o.status::text as status,
      a.is_buyer,
      a.position as attendee_position,
      o.id as order_id,
      o.created_at
    from public.attendees a
    join ord o on o.id = a.order_id
  ),
  -- ordenes legacy (sin attendees): expandir con buyer
  legacy_orders as (
    select o.*
    from ord o
    where not exists (select 1 from public.attendees a where a.order_id = o.id)
  ),
  legacy_att as (
    select
      o.buyer_first_name as first_name,
      o.buyer_last_name as last_name,
      o.buyer_dni as dni,
      o.status::text as status,
      (gs.n = 1) as is_buyer,
      gs.n as attendee_position,
      o.id as order_id,
      o.created_at
    from legacy_orders o
    cross join lateral generate_series(1, o.total_qty) as gs(n)
  ),
  unioned as (
    select * from real_att
    union all
    select * from legacy_att
  )
  select first_name, last_name, dni, status, is_buyer, attendee_position, order_id, created_at
  from unioned
  order by last_name asc, first_name asc, created_at asc, attendee_position asc
  limit 5000;
$$;

revoke all on function public.get_event_attendees(text, text) from public;
grant execute on function public.get_event_attendees(text, text) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5) Lista admin de invitados: incluye email + teléfono del comprador + monto
-- -----------------------------------------------------------------------------
drop function if exists public.get_event_attendees_admin(uuid);

create or replace function public.get_event_attendees_admin(
  p_event_id uuid
) returns table (
  order_id uuid,
  attendee_position int,
  first_name text,
  last_name text,
  dni text,
  phone text,
  is_buyer boolean,
  buyer_email text,
  buyer_phone text,
  unit_price_ars numeric,
  status text,
  created_at timestamptz,
  validated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with ord as (
    select o.*
    from public.orders o
    where o.event_id = p_event_id
      and o.status in ('validated','manual_review','pending_validation')
  ),
  -- precio promedio por orden para distribuir el "subtotal"
  per_order_avg as (
    select order_id, avg(unit_price_ars)::numeric as avg_unit
    from public.order_items
    group by order_id
  ),
  real_att as (
    select
      o.id as order_id,
      a.position as attendee_position,
      a.first_name,
      a.last_name,
      a.dni,
      a.phone,
      a.is_buyer,
      o.buyer_email,
      o.buyer_phone,
      coalesce(p.avg_unit, 0)::numeric as unit_price_ars,
      o.status::text as status,
      o.created_at,
      o.validated_at
    from public.attendees a
    join ord o on o.id = a.order_id
    left join per_order_avg p on p.order_id = o.id
  ),
  legacy_orders as (
    select o.*
    from ord o
    where not exists (select 1 from public.attendees a where a.order_id = o.id)
  ),
  legacy_att as (
    select
      o.id as order_id,
      gs.n as attendee_position,
      o.buyer_first_name as first_name,
      o.buyer_last_name as last_name,
      o.buyer_dni as dni,
      o.buyer_phone as phone,
      (gs.n = 1) as is_buyer,
      o.buyer_email,
      o.buyer_phone,
      coalesce(p.avg_unit, 0)::numeric as unit_price_ars,
      o.status::text as status,
      o.created_at,
      o.validated_at
    from legacy_orders o
    cross join lateral generate_series(1, o.total_qty) as gs(n)
    left join per_order_avg p on p.order_id = o.id
  ),
  unioned as (
    select * from real_att
    union all
    select * from legacy_att
  )
  select order_id, attendee_position, first_name, last_name, dni, phone, is_buyer, buyer_email, buyer_phone,
         unit_price_ars, status, created_at, validated_at
  from unioned
  order by last_name asc, first_name asc, created_at asc, attendee_position asc
  limit 10000;
$$;

revoke all on function public.get_event_attendees_admin(uuid) from public;
grant execute on function public.get_event_attendees_admin(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 6) Vista del comprador: ahora cada ticket trae el nombre de su asistente
-- -----------------------------------------------------------------------------
create or replace function public.get_buyer_order_view(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb;
  v_event jsonb;
  v_items jsonb;
  v_tickets jsonb;
begin
  select to_jsonb(o.*) - 'proof_object_path' - 'proof_sha256' - 'mp_payment_id'
    into v_order
  from public.orders o
  where o.id = p_order_id;

  if v_order is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'slug', e.slug,
    'place', e.place,
    'starts_at', e.starts_at,
    'cover_image_url', e.cover_image_url,
    'org_slug', org.slug,
    'org_name', org.name
  )
    into v_event
  from public.events e
  join public.organizations org on org.id = e.organization_id
  where e.id = (v_order->>'event_id')::uuid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'qty', oi.qty,
    'unit_price_ars', oi.unit_price_ars,
    'ticket_type_name', tt.name
  ) order by tt.name), '[]'::jsonb)
    into v_items
  from public.order_items oi
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  where oi.order_id = p_order_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'uid', t.uid,
    'status', t.status,
    'ticket_type_name', tt.name,
    'issued_at', t.issued_at,
    'attendee_first_name', a.first_name,
    'attendee_last_name', a.last_name,
    'attendee_position', a.position
  ) order by t.issued_at), '[]'::jsonb)
    into v_tickets
  from public.tickets t
  join public.ticket_types tt on tt.id = t.ticket_type_id
  left join public.attendees a on a.id = t.attendee_id
  where t.order_id = p_order_id;

  return jsonb_build_object(
    'order', v_order,
    'event', v_event,
    'items', v_items,
    'tickets', v_tickets
  );
end;
$$;

revoke all on function public.get_buyer_order_view(uuid) from public;
grant execute on function public.get_buyer_order_view(uuid) to anon, authenticated, service_role;

-- Refrescar cache PostgREST (a veces tarda en ver firmas nuevas)
notify pgrst, 'reload schema';

comment on table public.attendees is 'Una fila por entrada/asistente. position 1 = comprador, 2..N = acompañantes.';
comment on column public.tickets.attendee_id is 'FK al asistente concreto. Null en órdenes legacy previas a la migración.';
