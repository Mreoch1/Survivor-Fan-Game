-- Individual immunity (post-merge) support
-- Adds episode winner field and user picks table.

alter table public.episodes
add column if not exists immunity_winning_player_id text null;

create table if not exists public.individual_immunity_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  player_id text not null,
  created_at timestamptz not null default now(),
  unique(user_id, episode_id)
);

alter table public.individual_immunity_picks enable row level security;

drop policy if exists "individual immunity picks select own" on public.individual_immunity_picks;
create policy "individual immunity picks select own"
on public.individual_immunity_picks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "individual immunity picks upsert own" on public.individual_immunity_picks;
create policy "individual immunity picks upsert own"
on public.individual_immunity_picks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "individual immunity picks update own" on public.individual_immunity_picks;
create policy "individual immunity picks update own"
on public.individual_immunity_picks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "individual immunity picks delete own" on public.individual_immunity_picks;
create policy "individual immunity picks delete own"
on public.individual_immunity_picks
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "individual immunity picks admin read all" on public.individual_immunity_picks;
create policy "individual immunity picks admin read all"
on public.individual_immunity_picks
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

drop policy if exists "individual immunity picks admin manage all" on public.individual_immunity_picks;
create policy "individual immunity picks admin manage all"
on public.individual_immunity_picks
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

comment on column public.episodes.immunity_winning_player_id is
  'Post-merge winner of individual immunity for the episode.';
