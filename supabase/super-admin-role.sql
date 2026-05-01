-- Super admin en base de datos (más claro que env).
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;

drop policy if exists "super_admins_select_self" on public.super_admins;
create policy "super_admins_select_self" on public.super_admins
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.super_admins sa where sa.user_id = auth.uid());
$$;

grant execute on function public.is_super_admin() to authenticated;

