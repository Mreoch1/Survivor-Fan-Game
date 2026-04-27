-- Episode 7 manual bonus:
-- Award +1 tribe immunity point to users who picked Ozzy's tribe for Episode 7.
-- Ozzy's tribe in app data is Vatu.

with episode_7 as (
  select id
  from public.episodes
  where season = 50
    and episode_number = 7
  limit 1
),
eligible_users as (
  select distinct tip.user_id
  from public.tribe_immunity_picks tip
  join episode_7 e7 on e7.id = tip.episode_id
  where tip.tribe_id = 'vatu'
)
insert into public.user_season_points (
  user_id,
  season,
  points,
  survival_points,
  tribe_immunity_points,
  individual_immunity_points,
  vote_out_points,
  weeks_survived,
  eliminations_hit,
  last_week_delta
)
select
  eu.user_id,
  50,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  null
from eligible_users eu
on conflict (user_id, season) do nothing;

update public.user_season_points usp
set
  tribe_immunity_points = usp.tribe_immunity_points + 1,
  points = usp.survival_points + (usp.tribe_immunity_points + 1) + usp.individual_immunity_points + usp.vote_out_points
where usp.season = 50
  and usp.user_id in (
    select distinct tip.user_id
    from public.tribe_immunity_picks tip
    join public.episodes e on e.id = tip.episode_id
    where e.season = 50
      and e.episode_number = 7
      and tip.tribe_id = 'vatu'
  );
