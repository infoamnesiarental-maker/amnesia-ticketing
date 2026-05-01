-- UPDATE: agrega buyer_dni a get_event_attendees + nueva RPC privada con recaudación
-- Ejecutar en Supabase SQL Editor (proyecto Amnesia Rental ticketera)

-- Postgres no permite cambiar el tipo de retorno de una función con CREATE OR REPLACE.
-- Por eso primero dropeamos las versiones anteriores (si existen).
drop function if exists public.get_event_attendees(text, text);
drop function if exists public.get_event_attendees_admin(uuid);

-- 1) RPC pública: ahora devuelve DNI (enmascaramos en UI). Mantiene los mismos permisos.
create or replace function public.get_event_attendees(
  p_org_slug text,
  p_event_slug text
) returns table (
  buyer_first_name text,
  buyer_last_name text,
  buyer_dni text,
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
    o.buyer_dni,
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
  limit 5000;
$$;

revoke all on function public.get_event_attendees(text, text) from public;
grant execute on function public.get_event_attendees(text, text) to anon, authenticated, service_role;

-- 2) Nueva RPC privada (solo service_role): incluye datos completos + dinero
create or replace function public.get_event_attendees_admin(
  p_event_id uuid
) returns table (
  order_id uuid,
  buyer_first_name text,
  buyer_last_name text,
  buyer_dni text,
  buyer_email text,
  buyer_phone text,
  total_qty int,
  total_ars numeric,
  status text,
  created_at timestamptz,
  validated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    o.id,
    o.buyer_first_name,
    o.buyer_last_name,
    o.buyer_dni,
    o.buyer_email,
    o.buyer_phone,
    o.total_qty,
    o.total_ars,
    o.status::text,
    o.created_at,
    o.validated_at
  from public.orders o
  where o.event_id = p_event_id
    and o.status in ('validated','manual_review','pending_validation')
  order by o.buyer_last_name asc, o.buyer_first_name asc, o.created_at asc
  limit 10000;
$$;

revoke all on function public.get_event_attendees_admin(uuid) from public;
grant execute on function public.get_event_attendees_admin(uuid) to service_role;

comment on function public.get_event_attendees is 'Lista pública de invitados con DNI (la UI debe enmascararlo).';
comment on function public.get_event_attendees_admin is 'Lista admin de invitados (datos completos + monto). Solo service_role.';
