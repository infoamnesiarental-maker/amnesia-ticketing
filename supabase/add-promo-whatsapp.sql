-- Expone promo_whatsapp en la RPC pública get_ticketera_data.
-- Si la columna no existe en events todavía, también la agrega.
-- Ejecutar en Supabase SQL Editor.

alter table public.events
  add column if not exists promo_whatsapp text;

-- Reemplazar la función para incluir el campo en la respuesta pública.
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

notify pgrst, 'reload schema';
