-- Survivor Fan App: profiles, invites, episodes, picks
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) or via Supabase CLI.

-- Profiles (extend auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Invites for email sign-up
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  used_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists invites_token_idx on public.invites (token);
create index if not exists invites_email_idx on public.invites (email);

-- Episodes (per season); vote_out_lock_at = when picks lock for that episode
create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  episode_number int not null,
  vote_out_lock_at timestamptz not null,
  voted_out_player_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (season, episode_number)
);

-- Winner pick per user per season
create table if not exists public.winner_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  season int not null,
  created_at timestamptz default now() not null,
  unique (user_id, season)
);

-- Vote-out pick per user per episode
create table if not exists public.vote_out_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  player_id text not null,
  created_at timestamptz default now() not null,
  unique (user_id, episode_id)
);

-- Tribe pick per user per season
create table if not exists public.tribe_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tribe_id text not null,
  season int not null,
  created_at timestamptz default now() not null,
  unique (user_id, season)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.episodes enable row level security;
alter table public.winner_picks enable row level security;
alter table public.vote_out_picks enable row level security;
alter table public.tribe_picks enable row level security;

-- Profiles: users can read all (for leaderboard), update own
create policy "Profiles read" on public.profiles for select using (true);
create policy "Profiles update own" on public.profiles for update using (auth.uid() = id);
create policy "Profiles insert own" on public.profiles for insert with check (auth.uid() = id);

-- Invites: only inviter can create and read their own
create policy "Invites insert own" on public.invites for insert with check (auth.uid() = inviter_id);
create policy "Invites read own" on public.invites for select using (auth.uid() = inviter_id);

-- Accept invite by token (called from API when user is logged in)
create or replace function public.accept_invite(invite_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row record;
begin
  select id, used_at into invite_row from public.invites where token = invite_token limit 1;
  if invite_row.id is null then
    return false;
  end if;
  if invite_row.used_at is not null then
    return true;
  end if;
  update public.invites set used_at = now() where id = invite_row.id;
  return true;
end;
$$;

-- Episodes: authenticated users can read
create policy "Episodes read" on public.episodes for select to authenticated using (true);
-- Insert/update episodes via SQL or service role (e.g. add new episodes, set voted_out_player_id after each episode)

-- Picks: users manage own
create policy "Winner picks read" on public.winner_picks for select using (true);
create policy "Winner picks insert own" on public.winner_picks for insert with check (auth.uid() = user_id);
create policy "Winner picks update own" on public.winner_picks for update using (auth.uid() = user_id);
create policy "Winner picks delete own" on public.winner_picks for delete using (auth.uid() = user_id);

create policy "Vote out picks read" on public.vote_out_picks for select using (true);
create policy "Vote out picks insert own" on public.vote_out_picks for insert with check (auth.uid() = user_id);
create policy "Vote out picks update own" on public.vote_out_picks for update using (auth.uid() = user_id);
create policy "Vote out picks delete own" on public.vote_out_picks for delete using (auth.uid() = user_id);

create policy "Tribe picks read" on public.tribe_picks for select using (true);
create policy "Tribe picks insert own" on public.tribe_picks for insert with check (auth.uid() = user_id);
create policy "Tribe picks update own" on public.tribe_picks for update using (auth.uid() = user_id);
create policy "Tribe picks delete own" on public.tribe_picks for delete using (auth.uid() = user_id);

-- Create profile on signup (trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed episode 1 for season 50 (adjust lock time as needed)
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 1, '2026-02-25 19:00:00-05')
on conflict (season, episode_number) do nothing;
