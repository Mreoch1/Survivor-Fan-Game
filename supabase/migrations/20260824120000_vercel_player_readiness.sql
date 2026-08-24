-- Player readiness for the Vercel-hosted Season 51 application.
alter table public.profiles
  add column if not exists league_joined_at timestamptz;

-- Profiles contain private preseason picks and commissioner status. The app
-- serves the public leaderboard through validated server routes instead.
drop policy if exists "Authenticated profiles read" on public.profiles;
drop policy if exists "Profiles server only" on public.profiles;
create policy "Profiles server only" on public.profiles
for select to authenticated using (false);

create index if not exists idx_profiles_joined_points
on public.profiles(total_points desc, created_at)
where league_joined_at is not null;
