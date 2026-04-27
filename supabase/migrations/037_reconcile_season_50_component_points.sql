-- Reconcile Season 50 component points from source picks/results.
-- Keeps survival_points as-is, recomputes vote_out/tribe/individual components,
-- then recomputes points = survival + tribe + individual + vote_out.

with vote_out_totals as (
  select
    vop.user_id,
    count(*) * 2 as vote_out_points
  from public.vote_out_picks vop
  join public.episodes e
    on e.id = vop.episode_id
   and e.season = 50
  where e.voted_out_player_id is not null
    and vop.player_id in (
      e.voted_out_player_id,
      e.second_voted_out_player_id,
      e.third_voted_out_player_id
    )
  group by vop.user_id
),
tribe_standard as (
  select
    tip.user_id,
    count(*) as points
  from public.tribe_immunity_picks tip
  join public.episode_immunity_tribes eit
    on eit.episode_id = tip.episode_id
   and eit.tribe_id = tip.tribe_id
  join public.episodes e
    on e.id = tip.episode_id
   and e.season = 50
  group by tip.user_id
),
tribe_ep7_bonus as (
  select
    tip.user_id,
    count(*) as points
  from public.tribe_immunity_picks tip
  join public.episodes e
    on e.id = tip.episode_id
   and e.season = 50
   and e.episode_number = 7
  where tip.tribe_id = 'vatu'
  group by tip.user_id
),
tribe_totals as (
  select
    user_id,
    sum(points) as tribe_immunity_points
  from (
    select user_id, points from tribe_standard
    union all
    select user_id, points from tribe_ep7_bonus
  ) t
  group by user_id
),
individual_totals as (
  select
    iip.user_id,
    count(*) as individual_immunity_points
  from public.individual_immunity_picks iip
  join public.episodes e
    on e.id = iip.episode_id
   and e.season = 50
  where e.immunity_winning_player_id is not null
    and iip.player_id = e.immunity_winning_player_id
  group by iip.user_id
)
update public.user_season_points usp
set
  vote_out_points = coalesce(vt.vote_out_points, 0),
  tribe_immunity_points = coalesce(tt.tribe_immunity_points, 0),
  individual_immunity_points = coalesce(it.individual_immunity_points, 0),
  points = usp.survival_points
    + coalesce(tt.tribe_immunity_points, 0)
    + coalesce(it.individual_immunity_points, 0)
    + coalesce(vt.vote_out_points, 0)
from public.user_season_points base
left join vote_out_totals vt on vt.user_id = base.user_id
left join tribe_totals tt on tt.user_id = base.user_id
left join individual_totals it on it.user_id = base.user_id
where usp.user_id = base.user_id
  and usp.season = 50
  and base.season = 50;
