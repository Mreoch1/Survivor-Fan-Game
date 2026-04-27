-- Episode 7 Season 50 results + Episode 8 unlock
-- Source checks for Episode 7: Dee voted out, individual immunity phase active.

update public.episodes
set
  voted_out_player_id = 'dee-valladares',
  second_voted_out_player_id = null,
  third_voted_out_player_id = null,
  medevac_player_id = null,
  updated_at = now()
where season = 50
  and episode_number = 7;

-- Post-merge: no tribe immunity rows for Episode 7.
delete from public.episode_immunity_tribes
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 7
);

-- Re-open processing for Episode 7 result correction/idempotent replay.
delete from public.episode_points_processed
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 7
);

-- Insert next pick week (Episode 8).
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 8, '2026-04-15 20:00:00-04')
on conflict (season, episode_number) do update set
  vote_out_lock_at = excluded.vote_out_lock_at,
  updated_at = now();
