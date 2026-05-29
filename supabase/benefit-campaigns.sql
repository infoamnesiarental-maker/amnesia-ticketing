-- Campañas de beneficio reutilizables + códigos de un solo uso.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.benefit_campaigns (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  discounted_price_ars numeric(12,2) not null check (discounted_price_ars > 0),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  expires_at timestamptz,
  note text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists benefit_campaigns_org_idx on public.benefit_campaigns(organization_id, created_at desc);
create index if not exists benefit_campaigns_event_idx on public.benefit_campaigns(event_id, created_at desc);

create table if not exists public.benefit_campaign_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.benefit_campaigns(id) on delete cascade,
  code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'used', 'cancelled', 'expired')),
  used_order_id uuid references public.orders(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, code)
);

create index if not exists benefit_campaign_codes_campaign_idx on public.benefit_campaign_codes(campaign_id, created_at desc);
create index if not exists benefit_campaign_codes_status_idx on public.benefit_campaign_codes(status, created_at desc);

alter table public.benefit_campaigns enable row level security;
alter table public.benefit_campaign_codes enable row level security;

drop policy if exists "benefit_campaigns_select_super_admin" on public.benefit_campaigns;
create policy "benefit_campaigns_select_super_admin" on public.benefit_campaigns
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists "benefit_campaign_codes_select_super_admin" on public.benefit_campaign_codes;
create policy "benefit_campaign_codes_select_super_admin" on public.benefit_campaign_codes
  for select to authenticated
  using (
    exists (
      select 1
      from public.benefit_campaigns bc
      where bc.id = benefit_campaign_codes.campaign_id and public.is_super_admin()
    )
  );

