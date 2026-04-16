-- Add real lat/lng columns to the houses table
alter table public.houses
  add column if not exists lat float8,
  add column if not exists lng float8;
