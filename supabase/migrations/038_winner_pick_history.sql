-- Track every winner pick change so season scoring is fully auditable.

create table if not exists public.winner_pick_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season integer not null,
  episode_id uuid null references public.episodes(id) on delete set null,
  previous_player_id text null,
  player_id text null,
  source text not null default 'user',
  created_at timestamptz not null default now()
);

create index if not exists winner_pick_history_user_season_created_idx
  on public.winner_pick_history (user_id, season, created_at desc);

alter table public.winner_pick_history enable row level security;

drop policy if exists "winner pick history select own" on public.winner_pick_history;
create policy "winner pick history select own"
on public.winner_pick_history
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "winner pick history insert own" on public.winner_pick_history;
create policy "winner pick history insert own"
on public.winner_pick_history
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "winner pick history admin read all" on public.winner_pick_history;
create policy "winner pick history admin read all"
on public.winner_pick_history
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

comment on table public.winner_pick_history is
  'Audit log of winner pick changes, including previous value and episode context.';
