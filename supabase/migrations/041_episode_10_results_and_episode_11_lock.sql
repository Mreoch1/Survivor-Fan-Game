-- Episode 10 Season 50 results + Episode 11 unlock

update public.episodes
set
  voted_out_player_id = 'stephenie-lagrossa-kendrick',
  second_voted_out_player_id = null,
  third_voted_out_player_id = null,
  medevac_player_id = null,
  immunity_winning_player_id = 'tiffany-ervin',
  updated_at = now()
where season = 50
  and episode_number = 10;

-- Post-merge: no tribe immunity rows.
delete from public.episode_immunity_tribes
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 10
);

-- Ensure Episode 10 can be processed with current results.
delete from public.episode_points_processed
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 10
);

-- Insert next pick week (Episode 11).
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 11, '2026-05-13 20:00:00-04')
on conflict (season, episode_number) do update set
  vote_out_lock_at = excluded.vote_out_lock_at,
  updated_at = now();
