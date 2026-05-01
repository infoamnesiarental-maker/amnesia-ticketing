-- Multi-productora: credenciales de Mercado Pago por organización
-- Permite que Make valide pagos con el token de cada productora.
-- Acceso solo via service_role (server-side) o RPC `get_org_mp_token` (pensada para Make).

create table if not exists public.mp_credentials (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  access_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mp_credentials enable row level security;

-- No hay políticas para anon/authenticated: SOLO service_role puede leer/escribir.
-- (Sin políticas + RLS on => acceso bloqueado salvo service_role.)

-- Auditoría liviana al actualizar
create or replace function public.mp_credentials_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_mp_credentials_updated_at on public.mp_credentials;
create trigger trg_mp_credentials_updated_at
before update on public.mp_credentials
for each row execute function public.mp_credentials_set_updated_at();

-- -----------------------------------------------------------------------------
-- RPC pensada para Make: dado un order_id, devuelve el token MP de la org dueña.
-- IMPORTANTE: solo service_role puede ejecutarla (la grant está en service_role).
-- -----------------------------------------------------------------------------
create or replace function public.get_org_mp_token(p_order_id uuid)
returns table (
  organization_id uuid,
  access_token text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select c.organization_id, c.access_token
  from public.mp_credentials c
  join public.events e on e.organization_id = c.organization_id
  join public.orders o on o.event_id = e.id
  where o.id = p_order_id;
end;
$$;

revoke all on function public.get_org_mp_token(uuid) from public;
grant execute on function public.get_org_mp_token(uuid) to service_role;

comment on table public.mp_credentials is 'Credenciales Mercado Pago por organización. Acceso solo desde service_role (Make/Edge/Server).';
comment on function public.get_org_mp_token is 'Devuelve token MP de la productora dueña de una orden. Llamar desde Make con service_role.';
