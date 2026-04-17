-- Add notes column to houses table
alter table public.houses add column if not exists notes text not null default '';
