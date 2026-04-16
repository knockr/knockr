-- ── 1. Set auth metadata ─────────────────────────────────────────────────────
update auth.users
set raw_user_meta_data = '{"name":"Jordan K.","avatar":"JK","color":"#00e5ff","role":"rep"}'::jsonb
where id = 'e29b8e0b-ff3c-4509-a3dd-1d5830285341';

update auth.users
set raw_user_meta_data = '{"name":"Admin","avatar":"AD","color":"#a78bfa","role":"manager"}'::jsonb
where id = '0c295c2d-1bef-4764-bca4-5bc1cdc5b51f';

-- ── 2. Upsert profiles (creates rows if trigger didn't fire) ─────────────────
insert into public.profiles (id, name, email, avatar, color, role, status)
values
  ('e29b8e0b-ff3c-4509-a3dd-1d5830285341', 'Jordan K.', 'jordan@knockr.io', 'JK', '#00e5ff', 'rep',     'active'),
  ('0c295c2d-1bef-4764-bca4-5bc1cdc5b51f', 'Admin',     'admin@knockr.io',  'AD', '#a78bfa', 'manager', 'active')
on conflict (id) do update set
  name   = excluded.name,
  avatar = excluded.avatar,
  color  = excluded.color,
  role   = excluded.role,
  status = excluded.status;
