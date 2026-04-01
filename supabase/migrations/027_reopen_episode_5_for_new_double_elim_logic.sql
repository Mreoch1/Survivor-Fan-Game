-- Re-open Episode 5 for processing after deploying double-elimination logic.
-- This ensures scoring can be run again with second_voted_out_player_id support.

delete from public.episode_points_processed
where episode_id in (
  select id
  from public.episodes
  where season = 50 and episode_number = 5
);

