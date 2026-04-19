-- ─────────────────────────────────────────────────────────────────────────────
-- KNOCKR — Migration 002
-- Follow-up to supabase-migration.sql
-- Adds: knocks table, wider status constraint, lat/lng/notes on houses,
--       sale_value on leads, RLS for knocks
-- Run in Supabase → SQL Editor after supabase-migration.sql
-- Safe to re-run (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. WIDEN houses.status CHECK CONSTRAINT ──────────────────────────────────
alter table public.houses drop constraint if exists houses_status_check;
alter table public.houses add constraint houses_status_check
  check (status in ('unvisited','no_answer','not_interested','answered','lead','avoid','sale'));

-- ── 2. ADD MISSING COLUMNS TO houses ─────────────────────────────────────────
-- lat/lng use double precision for full GPS accuracy
-- (lat ≈ 43.x for Toronto, lng ≈ -79.x for Toronto)
alter table public.houses add column if not exists lat   double precision;
alter table public.houses add column if not exists lng   double precision;
alter table public.houses add column if not exists notes text not null default '';

-- Make legacy x/y nullable (kept for data preservation, no longer used)
alter table public.houses alter column x drop not null;
alter table public.houses alter column y drop not null;

-- ── 3. ADD sale_value TO leads ───────────────────────────────────────────────
alter table public.leads add column if not exists sale_value numeric;

-- ── 4. CREATE knocks TABLE ───────────────────────────────────────────────────
create table if not exists public.knocks (
  id         uuid        primary key default gen_random_uuid(),
  house_id   uuid        not null references public.houses(id)    on delete cascade,
  rep_id     uuid        not null references public.profiles(id)  on delete cascade,
  session_id uuid        not null references public.sessions(id)  on delete cascade,
  status     text        not null
               check (status in ('unvisited','no_answer','not_interested','answered','lead','avoid','sale')),
  notes      text        not null default '',
  created_at timestamptz not null default now()
);

create index if not exists knocks_house_id_idx on public.knocks(house_id);

-- ── 5. ENABLE RLS ON knocks ──────────────────────────────────────────────────
alter table public.knocks enable row level security;

drop policy if exists "Reps see own knocks; managers see all" on public.knocks;
create policy "Reps see own knocks; managers see all"
  on public.knocks for select
  using (rep_id = auth.uid() or public.is_manager());

drop policy if exists "Reps insert own knocks" on public.knocks;
create policy "Reps insert own knocks"
  on public.knocks for insert
  with check (rep_id = auth.uid());

drop policy if exists "Reps update own knocks" on public.knocks;
create policy "Reps update own knocks"
  on public.knocks for update
  using (rep_id = auth.uid());
