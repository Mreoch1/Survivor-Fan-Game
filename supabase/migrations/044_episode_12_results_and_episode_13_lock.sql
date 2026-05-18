-- Episode 12 Season 50 results + Episode 13 (finale) unlock
-- Double tribal: Rick Devens and Cirie Fields voted out; Joe Hunter won individual immunity.

update public.episodes
set
  voted_out_player_id = 'rick-devens',
  second_voted_out_player_id = 'cirie-fields',
  third_voted_out_player_id = null,
  medevac_player_id = null,
  immunity_winning_player_id = 'joe-hunter',
  updated_at = now()
where season = 50
  and episode_number = 12;

delete from public.episode_immunity_tribes
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 12
);

delete from public.episode_points_processed
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 12
);

-- Finale week (Episode 13).
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 13, '2026-05-20 20:00:00-04')
on conflict (season, episode_number) do update set
  vote_out_lock_at = excluded.vote_out_lock_at,
  updated_at = now();
