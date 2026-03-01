-- Points breakdown: survival, tribe immunity, individual immunity (total = sum of all)

alter table public.user_season_points
  add column if not exists survival_points int not null default 0,
  add column if not exists tribe_immunity_points int not null default 0,
  add column if not exists individual_immunity_points int not null default 0;

comment on column public.user_season_points.survival_points is 'Points from winner pick: +1 per week survived, -1 when voted out';
comment on column public.user_season_points.tribe_immunity_points is 'Points from correct tribe immunity picks (pre-merge)';
comment on column public.user_season_points.individual_immunity_points is 'Points from correct individual immunity picks (post-merge)';

-- Backfill: existing points were all survival; total points stays points
update public.user_season_points
set survival_points = points,
    tribe_immunity_points = 0,
    individual_immunity_points = 0
where survival_points = 0 and tribe_immunity_points = 0 and individual_immunity_points = 0;
