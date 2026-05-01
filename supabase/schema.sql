-- AmnesiaTicketing - esquema inicial (multi-productora)
-- Objetivo: Auth en Supabase + Postgres como fuente de verdad + Storage para comprobantes.
-- Nota: este SQL es una base; ajustaremos RLS/policies según el flujo final.

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type public.organization_status as enum ('pending','approved','suspended','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_role as enum ('owner','admin','door');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pending_validation','validated','manual_review','rejected','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('issued','checked_in','void');
exception when duplicate_object then null; end $$;

-- Organizations (productoras)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  contact_email text not null,
  cuit text,
  status public.organization_status not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- Memberships (users from auth.users)
create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Access requests (para que el admin vea “alguien se registró / pidió alta”)
create table if not exists public.org_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  place text,
  starts_at timestamptz,
  cover_image_url text,
  catalog_flair text,
  mp_alias text not null,
  organizer_email text,
  mp_access_token_ref text, -- referencia interna (token real server-side: n8n/Make/Edge)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

-- Ticket types
create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  price_ars numeric(12,2) not null check (price_ars >= 0),
  stock_total int not null default 0 check (stock_total >= 0),
  sales_ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, slug)
);

-- Orders (buyer purchase intent + proof)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  status public.order_status not null default 'pending_validation',
  buyer_first_name text not null,
  buyer_last_name text not null,
  buyer_dni text not null,
  buyer_phone text not null,
  buyer_email text not null,
  total_qty int not null check (total_qty > 0),
  total_ars numeric(12,2) not null check (total_ars > 0),
  proof_object_path text not null, -- path in Storage bucket proofs
  proof_sha256 text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  rejected_at timestamptz
);

create unique index if not exists orders_proof_sha256_unique
  on public.orders (proof_sha256)
  where proof_sha256 is not null;

-- Order items (qty by ticket type)
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id),
  qty int not null check (qty > 0),
  unit_price_ars numeric(12,2) not null check (unit_price_ars >= 0)
);

-- Tickets (one per QR)
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id),
  uid text not null unique,
  payload jsonb not null,
  status public.ticket_status not null default 'issued',
  issued_at timestamptz not null default now()
);

-- Check-ins (idempotent by uid)
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  uid text not null,
  checked_in_at timestamptz not null default now(),
  device_id text,
  unique (uid)
);

-- Basic indexes
create index if not exists idx_events_org on public.events(organization_id);
create index if not exists idx_ticket_types_event on public.ticket_types(event_id);
create index if not exists idx_orders_event on public.orders(event_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_tickets_event on public.tickets(event_id);

