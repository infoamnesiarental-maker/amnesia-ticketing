-- Catálogo público de eventos para la landing (solo lectura).
-- Incluye columna opcional catalog_flair (etiqueta en la card).
-- Ejecutar en Supabase SQL Editor después de schema.sql, policies-mvp.sql y ticketera-public.sql.

alter table public.events add column if not exists catalog_flair text;

comment on column public.events.catalog_flair is 'Etiqueta corta para la card del catálogo (ej: Últimas entradas, Festival, Preventa).';

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
                and ord.status in (
                  'pending_validation'::public.order_status,
                  'validated'::public.order_status,
                  'manual_review'::public.order_status
                )
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
                and ord.status in (
                  'pending_validation'::public.order_status,
                  'validated'::public.order_status,
                  'manual_review'::public.order_status
                )
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
                    and ord.status in (
                      'pending_validation'::public.order_status,
                      'validated'::public.order_status,
                      'manual_review'::public.order_status
                    )
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
