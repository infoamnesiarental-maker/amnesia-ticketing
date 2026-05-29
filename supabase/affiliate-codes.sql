-- SISTEMA DE AFILIADOS
-- Permite crear códigos ?ref=CODIGO por evento y trackear conversiones en órdenes.
-- Ejecutar en Supabase SQL Editor.

-- ----------------------------------------------------------------------------
-- 1. Tabla affiliate_codes
-- ----------------------------------------------------------------------------
create table if not exists public.affiliate_codes (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  code        text not null check (length(btrim(code)) between 1 and 32),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (event_id, code)
);

create index if not exists idx_affiliate_codes_event on public.affiliate_codes(event_id);
create index if not exists idx_affiliate_codes_code  on public.affiliate_codes(code);

alter table public.affiliate_codes enable row level security;
-- Solo service_role escribe/lee (desde server actions).

comment on table  public.affiliate_codes         is 'Códigos de afiliado por evento. Se usan como ?ref=CODE en la URL pública.';
comment on column public.affiliate_codes.code    is 'Código que va en ?ref=CODE. Normalizado: mayúsculas, sin espacios.';

-- ----------------------------------------------------------------------------
-- 2. Columna affiliate_code en orders
-- ----------------------------------------------------------------------------
alter table public.orders
  add column if not exists affiliate_code text;

create index if not exists idx_orders_affiliate_code
  on public.orders(affiliate_code)
  where affiliate_code is not null;

-- ----------------------------------------------------------------------------
-- 3. Vista de estadísticas por afiliado (conveniente para el panel)
-- ----------------------------------------------------------------------------
create or replace view public.affiliate_stats as
select
  ac.id            as affiliate_code_id,
  ac.event_id,
  ac.name          as affiliate_name,
  ac.code          as affiliate_code,
  ac.is_active,
  ac.created_at,
  count(o.id)                                               as total_orders,
  count(o.id) filter (where o.status = 'validated')         as validated_orders,
  count(o.id) filter (where o.status = 'pending_validation') as pending_orders,
  coalesce(sum(o.total_ars) filter (where o.status = 'validated'), 0) as validated_ars,
  coalesce(sum(o.total_qty) filter (where o.status = 'validated'), 0) as validated_qty
from public.affiliate_codes ac
left join public.orders o
  on o.affiliate_code = ac.code
 and o.event_id = ac.event_id
group by ac.id;

-- Solo service_role accede a la vista
revoke all on public.affiliate_stats from public, anon, authenticated;
grant select on public.affiliate_stats to service_role;

-- ----------------------------------------------------------------------------
-- 4. RPC para crear un código de afiliado (evita duplicados con retry)
-- ----------------------------------------------------------------------------
create or replace function public.create_affiliate_code(
  p_event_id uuid,
  p_name     text,
  p_code     text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_event_id is null then raise exception 'event_id required'; end if;
  if btrim(p_name) = '' then raise exception 'name required'; end if;
  if btrim(p_code) = '' then raise exception 'code required'; end if;

  insert into public.affiliate_codes (event_id, name, code)
  values (p_event_id, btrim(p_name), upper(btrim(p_code)))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_affiliate_code(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_affiliate_code(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
