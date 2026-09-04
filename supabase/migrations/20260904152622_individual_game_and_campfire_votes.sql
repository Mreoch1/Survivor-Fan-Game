-- Add the two-stage season pick and one-vote-per-player Campfire reactions.
alter table public.profiles
  add column individual_game_pick text,
  add column endgame_pick text,
  add column endgame_pick_switched boolean not null default false,
  add column individual_game_points numeric(8,1) not null default 0,
  add column endgame_points numeric(8,1) not null default 0,
  add column endgame_pick_updated_at timestamptz;

-- Preserve any season picks made before this rule change as opening picks.
update public.profiles
set individual_game_pick = winner_pick
where winner_pick is not null;

alter table public.profiles
  alter column total_points type numeric(8,1) using total_points::numeric,
  alter column preseason_points type numeric(8,1) using preseason_points::numeric;

alter table public.episodes
  add column individual_game_started boolean not null default false;

create unique index idx_episodes_single_individual_game_start
on public.episodes (individual_game_started)
where individual_game_started;

create table public.post_votes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index idx_post_votes_user on public.post_votes(user_id);

alter table public.post_votes enable row level security;
revoke all on public.post_votes from anon, authenticated;
grant select, insert, update, delete on public.post_votes to service_role;
