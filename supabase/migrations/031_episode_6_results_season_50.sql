-- Episode 6 Season 50: "The Blood Moon" (aired Apr 1 2026)
-- Triple elimination: Kamilla Karthigesu, Genevieve Mushaluk, Colby Donaldson.
-- Merge week with individual immunity winners (no tribe immunity scoring).

delete from public.episode_immunity_tribes
where episode_id in (
  select id from public.episodes where season = 50 and episode_number = 6
);

delete from public.episode_points_processed
where episode_id in (
  select id from public.episodes where season = 50 and episode_number = 6
);

update public.episodes
set
  voted_out_player_id = 'kamilla-karthigesu',
  second_voted_out_player_id = 'genevieve-mushaluk',
  third_voted_out_player_id = 'colby-donaldson',
  immunity_winning_tribe_id = null,
  updated_at = now()
where season = 50 and episode_number = 6;
