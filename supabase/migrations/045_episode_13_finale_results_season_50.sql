-- Episode 13 Season 50 finale results
-- F5 vote: Tiffany; fire-making: Rizo; FTC: Joe (3rd), Jonathan (2nd); Aubry wins Sole Survivor.

update public.episodes
set
  voted_out_player_id = 'tiffany-ervin',
  second_voted_out_player_id = 'rizo-velovic',
  third_voted_out_player_id = 'joe-hunter',
  medevac_player_id = null,
  immunity_winning_player_id = 'aubry-bracco',
  updated_at = now()
where season = 50
  and episode_number = 13;

delete from public.episode_immunity_tribes
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 13
);

delete from public.episode_points_processed
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 13
);
