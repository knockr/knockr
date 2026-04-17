-- Create knocks table for communal knock history
create table if not exists public.knocks (
  id          uuid primary key default gen_random_uuid(),
  house_id    uuid references public.houses(id) on delete cascade,
  rep_id      uuid references auth.users(id),
  session_id  uuid references public.sessions(id),
  status      text not null,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.knocks enable row level security;

create policy "Reps can insert their own knocks"
  on public.knocks for insert
  with check (auth.uid() = rep_id);

create policy "All authenticated users can read knocks"
  on public.knocks for select
  using (auth.role() = 'authenticated');
