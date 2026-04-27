-- Episode 8 Season 50 results + Episode 9 unlock
-- Episode 8 twist: double elimination pair vote-out.

update public.episodes
set
  voted_out_player_id = 'benjamin-coach-wade',
  second_voted_out_player_id = 'chrissy-hofbeck',
  third_voted_out_player_id = null,
  medevac_player_id = null,
  -- Episode 8 immunity was awarded to a duo; keep single-winner field null.
  immunity_winning_player_id = null,
  updated_at = now()
where season = 50
  and episode_number = 8;

-- Post-merge: no tribe immunity rows.
delete from public.episode_immunity_tribes
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 8
);

-- Ensure Episode 8 can be processed with corrected/final results.
delete from public.episode_points_processed
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 8
);

-- Insert next pick week (Episode 9).
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 9, '2026-04-22 20:00:00-04')
on conflict (season, episode_number) do update set
  vote_out_lock_at = excluded.vote_out_lock_at,
  updated_at = now();
