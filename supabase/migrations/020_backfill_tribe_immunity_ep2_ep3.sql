-- Backfill tribe immunity points for episodes 2 and 3 (already processed without multi-tribe support).
-- +1 tribe_immunity_points and +1 points for each user who picked a winning tribe for that episode.
update public.user_season_points usp
set
  tribe_immunity_points = usp.tribe_immunity_points + 1,
  points = usp.points + 1
from (
  select tip.user_id
  from public.tribe_immunity_picks tip
  join public.episode_immunity_tribes eit on eit.episode_id = tip.episode_id and eit.tribe_id = tip.tribe_id
  where tip.episode_id = (select id from public.episodes where season = 50 and episode_number = 2)
) sub
where usp.user_id = sub.user_id and usp.season = 50;

update public.user_season_points usp
set
  tribe_immunity_points = usp.tribe_immunity_points + 1,
  points = usp.points + 1
from (
  select tip.user_id
  from public.tribe_immunity_picks tip
  join public.episode_immunity_tribes eit on eit.episode_id = tip.episode_id and eit.tribe_id = tip.tribe_id
  where tip.episode_id = (select id from public.episodes where season = 50 and episode_number = 3)
) sub
where usp.user_id = sub.user_id and usp.season = 50;
