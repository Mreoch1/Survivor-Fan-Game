-- Receipts are written by the authenticated application route, never the browser Data API.
create table public.league_update_acknowledgements (
  user_id uuid not null references auth.users(id) on delete cascade,
  update_id text not null check (char_length(update_id) between 1 and 100),
  acknowledged_at timestamptz not null default now(),
  primary key (user_id, update_id)
);
create index league_update_acknowledgements_update_id_idx
  on public.league_update_acknowledgements (update_id);
alter table public.league_update_acknowledgements enable row level security;
revoke all on public.league_update_acknowledgements from public, anon, authenticated, service_role;
grant select, insert on public.league_update_acknowledgements to service_role;
