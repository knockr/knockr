-- ─────────────────────────────────────────────────────────────────────────────
-- KNOCKR — Full schema + RLS migration
-- Run this once in Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. PROFILES ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  name      text        not null,
  email     text        not null unique,
  role      text        not null default 'rep' check (role in ('rep','manager')),
  avatar    text        not null default '',
  color     text        not null default '#00e5ff',
  status    text        not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

-- Auto-create profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email, avatar, color, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar', upper(left(split_part(new.email,'@',1),2))),
    coalesce(new.raw_user_meta_data->>'color', '#00e5ff'),
    coalesce(new.raw_user_meta_data->>'role', 'rep')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. SESSIONS ──────────────────────────────────────────────────────────────
create table if not exists public.sessions (
  id            uuid        primary key default gen_random_uuid(),
  rep_id        uuid        not null references public.profiles(id) on delete cascade,
  neighborhood  text        not null default '',
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  doors_knocked int         not null default 0,
  doors_answered int        not null default 0,
  leads_count   int         not null default 0,
  created_at    timestamptz not null default now()
);

-- ── 3. HOUSES ────────────────────────────────────────────────────────────────
create table if not exists public.houses (
  id         uuid  primary key default gen_random_uuid(),
  session_id uuid  not null references public.sessions(id) on delete cascade,
  rep_id     uuid  not null references public.profiles(id) on delete cascade,
  number     int   not null,
  street     text  not null,
  x          numeric not null,
  y          numeric not null,
  status     text  not null default 'unvisited'
               check (status in ('unvisited','no_answer','not_interested','answered','lead')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 4. LEADS ─────────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id           uuid  primary key default gen_random_uuid(),
  house_id     uuid  references public.houses(id) on delete set null,
  session_id   uuid  not null references public.sessions(id) on delete cascade,
  rep_id       uuid  not null references public.profiles(id) on delete cascade,
  name         text  not null default '',
  phone        text  not null default '',
  email        text  not null default '',
  service      text  not null default '',
  grade        text  not null default 'B' check (grade in ('A','B','C','D')),
  note         text  not null default '',
  neighborhood text  not null default '',
  address      text  not null default '',
  created_at   timestamptz not null default now()
);

-- ── 5. NEIGHBORHOODS ─────────────────────────────────────────────────────────
create table if not exists public.neighborhoods (
  id            uuid  primary key default gen_random_uuid(),
  slug          text  not null unique,
  name          text  not null,
  response_rate int   not null default 0,
  lead_rate     int   not null default 0,
  sessions      int   not null default 0,
  doors         int   not null default 0,
  path          text  not null default '',
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.sessions      enable row level security;
alter table public.houses        enable row level security;
alter table public.leads         enable row level security;
alter table public.neighborhoods enable row level security;

-- Helper: is the current user a manager?
create or replace function public.is_manager()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

-- ── profiles ──
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid() or public.is_manager());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- ── sessions ──
create policy "Reps see own sessions; managers see all"
  on public.sessions for select
  using (rep_id = auth.uid() or public.is_manager());

create policy "Reps create own sessions"
  on public.sessions for insert
  with check (rep_id = auth.uid());

create policy "Reps update own sessions"
  on public.sessions for update
  using (rep_id = auth.uid());

-- ── houses ──
create policy "Reps see own houses; managers see all"
  on public.houses for select
  using (rep_id = auth.uid() or public.is_manager());

create policy "Reps insert own houses"
  on public.houses for insert
  with check (rep_id = auth.uid());

create policy "Reps update own houses"
  on public.houses for update
  using (rep_id = auth.uid());

-- ── leads ──
create policy "Reps see own leads; managers see all"
  on public.leads for select
  using (rep_id = auth.uid() or public.is_manager());

create policy "Reps insert own leads"
  on public.leads for insert
  with check (rep_id = auth.uid());

create policy "Reps update own leads"
  on public.leads for update
  using (rep_id = auth.uid());

-- ── neighborhoods ──
create policy "All authenticated users can read neighborhoods"
  on public.neighborhoods for select
  using (auth.role() = 'authenticated');

create policy "Only managers can modify neighborhoods"
  on public.neighborhoods for all
  using (public.is_manager());

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed neighborhoods (static heatmap data)
insert into public.neighborhoods (slug, name, response_rate, lead_rate, sessions, doors, path) values
  ('annex',      'The Annex',     68, 22, 14, 312, 'M 270,108 L 332,102 L 345,155 L 285,152 Z'),
  ('midtown',    'Midtown',       54, 14,  9, 198, 'M 285,152 L 412,158 L 418,210 L 290,215 Z'),
  ('rosedale',   'Rosedale',      41, 31,  6, 124, 'M 345,155 L 412,158 L 418,210 L 355,215 Z'),
  ('foresthill', 'Forest Hill',   38, 28,  5, 108, 'M 210,115 L 270,108 L 285,152 L 218,158 Z'),
  ('yorkdale',   'Yorkdale',      71, 18, 11, 247, 'M 155,20  L 205,20  L 218,55  L 192,72  L 155,68  Z'),
  ('leaside',    'Leaside',       62, 20,  8, 176, 'M 398,98  L 458,95  L 472,155 L 412,158 Z'),
  ('eastyork',   'East York',     49, 12,  7, 163, 'M 412,158 L 472,155 L 480,218 L 418,210 Z'),
  ('downsview',  'Downsview',     33,  8,  4,  89, 'M 80,15   L 152,15  L 155,68  L 118,75  L 80,60   Z'),
  ('weston',     'Weston',        44, 11,  5, 112, 'M 48,62   L 118,75  L 118,108 L 68,115  L 48,92   Z'),
  ('york',       'York',          57, 16, 10, 218, 'M 118,75  L 192,72  L 210,115 L 155,122 L 118,108 Z'),
  ('eglinton',   'Eglinton West', 60, 19,  8, 187, 'M 118,108 L 210,115 L 218,158 L 148,162 L 118,142 Z'),
  ('davisville', 'Davisville',    65, 24, 12, 276, 'M 332,102 L 398,98  L 412,158 L 345,155 Z')
on conflict (slug) do nothing;
