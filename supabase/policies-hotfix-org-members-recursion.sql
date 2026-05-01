-- Hotfix: solo si ya aplicaste policies-mvp.sql viejo y tenés error
-- "infinite recursion detected in policy for relation org_members"
-- Pegá esto en Supabase SQL Editor y ejecutá.

drop policy if exists "member_select" on public.org_members;

create policy "member_select" on public.org_members
  for select using (user_id = auth.uid());
