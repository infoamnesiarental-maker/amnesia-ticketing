-- Ticketera pública: RPC de lectura segura + RLS en orders/order_items + bucket Storage para comprobantes.
-- Ejecutar en Supabase SQL Editor después de schema.sql y policies-mvp.sql.

-- -----------------------------------------------------------------------------
-- Bucket Storage (comprobantes; privado; subida solo server-side con service_role)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proofs',
  'proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- RPC: datos públicos del evento + tipos con cupo disponible (sin exponer token MP)
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
      'cover_image_url', e.cover_image_url
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
                      and ord.status in (
                        'pending_validation'::public.order_status,
                        'validated'::public.order_status,
                        'manual_review'::public.order_status
                      )
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
                and ord.status in (
                  'pending_validation'::public.order_status,
                  'validated'::public.order_status,
                  'manual_review'::public.order_status
                )
            ),
            0
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

grant execute on function public.get_ticketera_data(text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS: órdenes visibles solo para miembros de la productora del evento
-- -----------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.org_access_requests enable row level security;

drop policy if exists "orders_select_org_member" on public.orders;
create policy "orders_select_org_member" on public.orders
  for select to authenticated
  using (
    exists (
      select 1 from public.events ev
      join public.org_members m on m.organization_id = ev.organization_id
      where ev.id = orders.event_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "order_items_select_org_member" on public.order_items;
create policy "order_items_select_org_member" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders ord
      join public.events ev on ev.id = ord.event_id
      join public.org_members m on m.organization_id = ev.organization_id
      where ord.id = order_items.order_id and m.user_id = auth.uid()
    )
  );

-- Sin políticas INSERT/UPDATE/DELETE para anon/authenticated: las compras públicas
-- se registran con SUPABASE_SERVICE_ROLE_KEY en el servidor (Next.js).

-- RLS: acceso requests solo para miembros con session (verificación propia) o service_role
drop policy if exists "org_access_requests_select_self" on public.org_access_requests;
create policy "org_access_requests_select_self" on public.org_access_requests
  for select to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Storage: permitir a miembros de la org ver comprobantes vía signed URL (server-side)
-- Nota: para acceder al archivo, la app generará signed URLs con service_role.
-- Estas policies habilitan lectura por miembro, pero solo aplican si alguien intenta
-- leer directamente el objeto vía Supabase Storage con sesión.
-- -----------------------------------------------------------------------------
drop policy if exists "proofs_read_org_member" on storage.objects;
create policy "proofs_read_org_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'proofs'
    and exists (
      select 1
      from public.orders ord
      join public.events ev on ev.id = ord.event_id
      join public.org_members m on m.organization_id = ev.organization_id
      where ord.proof_object_path = storage.objects.name
        and m.user_id = auth.uid()
    )
  );
