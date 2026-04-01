-- Allow Episode 5 to be reprocessed after enabling double-elimination support.
-- Also store Episode 5 second boot.

update public.episodes
set
  second_voted_out_player_id = 'charlie-davis',
  updated_at = now()
where season = 50 and episode_number = 5;

delete from public.episode_points_processed
where episode_id in (
  select id
  from public.episodes
  where season = 50 and episode_number = 5
);

