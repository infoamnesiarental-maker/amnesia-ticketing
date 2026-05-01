-- RLS MVP: multi-productora (ejecutar en Supabase SQL Editor después de schema.sql)
-- Si ya existían políticas, podés hacer DROP POLICY antes de re-ejecutar.
-- Ticketera pública + órdenes + Storage: ejecutar también supabase/ticketera-public.sql

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;

drop policy if exists "org_select_member" on public.organizations;
create policy "org_select_member" on public.organizations
  for select using (
    exists (
      select 1 from public.org_members m
      where m.organization_id = organizations.id and m.user_id = auth.uid()
    )
  );

-- No usar INSERT directo en organizations desde el cliente: el .select() post-insert falla RLS
-- (org_select exige org_members que todavía no existe). El alta va por RPC bootstrap_organization.
drop policy if exists "org_insert_authenticated" on public.organizations;

drop policy if exists "org_update_owner_admin" on public.organizations;
create policy "org_update_owner_admin" on public.organizations
  for update using (
    exists (
      select 1 from public.org_members m
      where m.organization_id = organizations.id and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- IMPORTANTE: no referenciar org_members dentro de un policy de org_members (recursión infinita en Postgres).
-- MVP: cada usuario solo ve sus propias filas de membresía; alcanza para organization_id y roles.
drop policy if exists "member_select" on public.org_members;
create policy "member_select" on public.org_members
  for select using (user_id = auth.uid());

drop policy if exists "member_insert_self" on public.org_members;
create policy "member_insert_self" on public.org_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "events_select_member" on public.events;
create policy "events_select_member" on public.events
  for select using (
    exists (
      select 1 from public.org_members m
      where m.organization_id = events.organization_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "events_insert_member" on public.events;
create policy "events_insert_member" on public.events
  for insert with check (
    exists (
      select 1
      from public.org_members m
      join public.organizations o on o.id = m.organization_id
      where m.organization_id = events.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and o.status = 'approved'::public.organization_status
    )
  );

drop policy if exists "events_update_member" on public.events;
create policy "events_update_member" on public.events
  for update using (
    exists (
      select 1
      from public.org_members m
      join public.organizations o on o.id = m.organization_id
      where m.organization_id = events.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and o.status = 'approved'::public.organization_status
    )
  );

drop policy if exists "events_delete_member" on public.events;
create policy "events_delete_member" on public.events
  for delete using (
    exists (
      select 1
      from public.org_members m
      join public.organizations o on o.id = m.organization_id
      where m.organization_id = events.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and o.status = 'approved'::public.organization_status
    )
  );

drop policy if exists "ticket_types_select" on public.ticket_types;
create policy "ticket_types_select" on public.ticket_types
  for select using (
    exists (
      select 1 from public.events e
      join public.org_members m on m.organization_id = e.organization_id
      where e.id = ticket_types.event_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "ticket_types_insert" on public.ticket_types;
create policy "ticket_types_insert" on public.ticket_types
  for insert with check (
    exists (
      select 1
      from public.events e
      join public.org_members m on m.organization_id = e.organization_id
      join public.organizations o on o.id = e.organization_id
      where e.id = ticket_types.event_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and o.status = 'approved'::public.organization_status
    )
  );

drop policy if exists "ticket_types_update" on public.ticket_types;
create policy "ticket_types_update" on public.ticket_types
  for update using (
    exists (
      select 1
      from public.events e
      join public.org_members m on m.organization_id = e.organization_id
      join public.organizations o on o.id = e.organization_id
      where e.id = ticket_types.event_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and o.status = 'approved'::public.organization_status
    )
  );

drop policy if exists "ticket_types_delete" on public.ticket_types;
create policy "ticket_types_delete" on public.ticket_types
  for delete using (
    exists (
      select 1
      from public.events e
      join public.org_members m on m.organization_id = e.organization_id
      join public.organizations o on o.id = e.organization_id
      where e.id = ticket_types.event_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and o.status = 'approved'::public.organization_status
    )
  );

-- -----------------------------------------------------------------------------
-- RPC: crear organización + membresía owner en una transacción (bypass RLS seguro).
-- -----------------------------------------------------------------------------
create or replace function public.bootstrap_organization(
  p_name text,
  p_slug text,
  p_contact_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_email := coalesce(nullif(trim(p_contact_email), ''), (select email from auth.users where id = auth.uid()));

  if v_email is null or v_email = '' then
    raise exception 'contact email required';
  end if;

  insert into public.organizations (slug, name, contact_email, status, approved_at)
  values (
    p_slug,
    p_name,
    v_email,
    case when public.is_super_admin() then 'approved'::public.organization_status else 'pending'::public.organization_status end,
    case when public.is_super_admin() then now() else null end
  )
  returning id into v_org_id;

  insert into public.org_members (organization_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner'::public.member_role);

  return v_org_id;
end;
$$;

grant execute on function public.bootstrap_organization(text, text, text) to authenticated;
