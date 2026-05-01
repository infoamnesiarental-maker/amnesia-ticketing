-- Ejecutar en Supabase SQL Editor si ya tenías policies-mvp con INSERT directo en organizations.
-- Quita INSERT público y registra la RPC que crea org + org_members en una transacción.

drop policy if exists "org_insert_authenticated" on public.organizations;

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
