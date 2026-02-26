-- Survival points: +1 per week your pick stays in, -1 when voted out then repick until finals

-- Running points per user per season
create table if not exists public.user_season_points (
  user_id uuid not null references auth.users (id) on delete cascade,
  season int not null,
  points int not null default 0,
  primary key (user_id, season)
);

-- Track which episodes have had survival points applied (so we don't double-count)
create table if not exists public.episode_points_processed (
  episode_id uuid primary key references public.episodes (id) on delete cascade
);

alter table public.episode_points_processed enable row level security;
create policy "Episode points processed read" on public.episode_points_processed for select using (true);
create policy "Episode points processed insert" on public.episode_points_processed for insert with check (true);

-- Allow clearing winner pick when voted out (user must repick)
alter table public.winner_picks
  alter column player_id drop not null;

-- RLS for user_season_points
alter table public.user_season_points enable row level security;

create policy "User season points read" on public.user_season_points for select using (true);
create policy "User season points insert own" on public.user_season_points for insert with check (auth.uid() = user_id);
create policy "User season points update own" on public.user_season_points for update using (auth.uid() = user_id);
