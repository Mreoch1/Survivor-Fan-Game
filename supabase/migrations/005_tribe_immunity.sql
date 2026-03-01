-- Tribe immunity: per-episode result and user picks (pre-merge). +1 for correct pick when scored.

alter table public.episodes
  add column if not exists immunity_winning_tribe_id text;

comment on column public.episodes.immunity_winning_tribe_id is 'Tribe that won immunity this episode (pre-merge). Set when results are in; used for tribe immunity scoring.';

-- User pick: which tribe wins immunity this episode (one per user per episode)
create table if not exists public.tribe_immunity_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  tribe_id text not null,
  created_at timestamptz default now() not null,
  unique (user_id, episode_id)
);

comment on table public.tribe_immunity_picks is 'Per-episode pick: which tribe wins immunity (pre-merge). Correct pick = +1 tribe_immunity_points when episode is processed.';

alter table public.tribe_immunity_picks enable row level security;

create policy "Tribe immunity picks read" on public.tribe_immunity_picks for select using (true);
create policy "Tribe immunity picks insert own" on public.tribe_immunity_picks for insert with check (auth.uid() = user_id);
create policy "Tribe immunity picks update own" on public.tribe_immunity_picks for update using (auth.uid() = user_id);
create policy "Tribe immunity picks delete own" on public.tribe_immunity_picks for delete using (auth.uid() = user_id);
