-- Allow re-running Process episode for episode 1 so both Jenna (voted out) and Kyle (medevac) are applied.
-- If you had already run Process episode before adding Kyle, delete the processed row and click Process episode again.

delete from public.episode_points_processed
where episode_id = (select id from public.episodes where season = 50 and episode_number = 1 limit 1);
