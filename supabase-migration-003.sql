-- ─────────────────────────────────────────────────────────────────────────────
-- KNOCKR — Migration 003
-- Multi-tenant schema foundation
-- Adds: businesses table, business_id columns everywhere, owner role,
--       is_active_rep flag, helper functions, seed + backfill
-- Run in Supabase → SQL Editor after migration 002.
-- Safe to re-run (idempotent). App keeps working after this — no RLS changes yet.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. BUSINESSES TABLE ──────────────────────────────────────────────────────
create table if not exists public.businesses (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  industry       text,
  admin_id       uuid references public.profiles(id),
  status         text not null default 'active' check (status in ('active','paused','archived')),
  billing_status text not null default 'trial' check (billing_status in ('trial','active','paused','churned')),
  created_at     timestamptz not null default now()
);

-- ── 2. WIDEN profiles.role TO INCLUDE 'owner' ────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('rep','admin','manager','owner'));

-- ── 3. ADD COLUMNS TO profiles ───────────────────────────────────────────────
alter table public.profiles add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.profiles add column if not exists is_active_rep boolean not null default false;

-- ── 4. ADD business_id TO SCOPED TABLES ──────────────────────────────────────
alter table public.sessions add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.houses   add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.leads    add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.knocks   add column if not exists business_id uuid references public.businesses(id) on delete cascade;

-- ── 5. HELPER FUNCTIONS ──────────────────────────────────────────────────────
create or replace function public.my_business_id()
returns uuid language sql security definer stable as $$
  select business_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ── 6. SEED DEFAULT BUSINESS + BACKFILL ──────────────────────────────────────
insert into public.businesses (name, slug, industry, status, billing_status)
values ('Knockr Test Company', 'knockr-test', 'general', 'active', 'trial')
on conflict (slug) do nothing;

do $$
declare
  default_biz_id uuid;
begin
  select id into default_biz_id from public.businesses where slug = 'knockr-test';

  update public.profiles set business_id = default_biz_id where business_id is null;
  update public.sessions set business_id = default_biz_id where business_id is null;
  update public.houses   set business_id = default_biz_id where business_id is null;
  update public.leads    set business_id = default_biz_id where business_id is null;
  update public.knocks   set business_id = default_biz_id where business_id is null;

  update public.profiles set role = 'admin'
    where role = 'manager' and business_id = default_biz_id;

  update public.businesses
    set admin_id = (select id from public.profiles where business_id = default_biz_id and role = 'admin' limit 1)
    where slug = 'knockr-test' and admin_id is null;
end $$;
