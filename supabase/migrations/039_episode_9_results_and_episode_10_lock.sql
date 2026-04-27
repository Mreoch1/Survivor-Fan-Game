-- Episode 9 Season 50 results + Episode 10 unlock

update public.episodes
set
  voted_out_player_id = 'christian-hubicki',
  second_voted_out_player_id = null,
  third_voted_out_player_id = null,
  medevac_player_id = null,
  immunity_winning_player_id = 'joe-hunter',
  updated_at = now()
where season = 50
  and episode_number = 9;

-- Post-merge: no tribe immunity rows.
delete from public.episode_immunity_tribes
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 9
);

-- Ensure Episode 9 can be processed with current results.
delete from public.episode_points_processed
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 9
);

-- Insert next pick week (Episode 10).
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 10, '2026-04-29 20:00:00-04')
on conflict (season, episode_number) do update set
  vote_out_lock_at = excluded.vote_out_lock_at,
  updated_at = now();
