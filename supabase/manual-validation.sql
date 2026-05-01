-- Validación manual + vista pública del comprador + lista de invitados
-- Ejecutar en Supabase SQL Editor (proyecto Amnesia Rental ticketera)
-- Requiere: schema.sql, policies-mvp.sql, ticketera-public.sql, mvp-make-finalize-order.sql

-- -----------------------------------------------------------------------------
-- 1) RPC: rechazar orden (manual, productora). Idempotente.
-- -----------------------------------------------------------------------------
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

  return jsonb_build_object('ok', true, 'idempotent', false, 'order_id', p_order_id);
end;
$$;

revoke all on function public.reject_order(uuid, text, uuid) from public;
grant execute on function public.reject_order(uuid, text, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 2) RPC: lista pública de invitados validados de un evento (sin datos sensibles)
-- Devuelve: nombre, apellido, total_qty, status (validated|manual_review|pending_validation)
-- -----------------------------------------------------------------------------
create or replace function public.get_event_attendees(
  p_org_slug text,
  p_event_slug text
) returns table (
  buyer_first_name text,
  buyer_last_name text,
  total_qty int,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    o.buyer_first_name,
    o.buyer_last_name,
    o.total_qty,
    o.status::text,
    o.created_at
  from public.orders o
  join public.events e on e.id = o.event_id
  join public.organizations org on org.id = e.organization_id
  where org.slug = p_org_slug
    and e.slug = p_event_slug
    and org.status = 'approved'
    and o.status in ('validated','manual_review','pending_validation')
  order by o.buyer_last_name asc, o.buyer_first_name asc, o.created_at asc
  limit 1000;
$$;

revoke all on function public.get_event_attendees(text, text) from public;
grant execute on function public.get_event_attendees(text, text) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) RPC: vista del comprador (acceso por order_id, sin login)
-- El UUID v4 actúa como token: si no lo conocés, no podés ver la orden.
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
    'issued_at', t.issued_at
  ) order by t.issued_at), '[]'::jsonb)
    into v_tickets
  from public.tickets t
  join public.ticket_types tt on tt.id = t.ticket_type_id
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

comment on function public.get_event_attendees is 'Lista pública de invitados (validados + en revisión) por evento. Sin DNI/email/teléfono.';
comment on function public.get_buyer_order_view is 'Vista del comprador. Acceso por order_id (UUID v4 actúa como token).';
comment on function public.reject_order is 'Rechaza una orden (manual). Idempotente. Usar desde panel productora.';
