-- Leaderboard clarity: weeks survived (current streak), eliminations hit, last week delta

alter table public.user_season_points
  add column if not exists weeks_survived int not null default 0,
  add column if not exists eliminations_hit int not null default 0,
  add column if not exists last_week_delta int;

comment on column public.user_season_points.weeks_survived is 'Weeks current pick has survived (resets when pick voted out)';
comment on column public.user_season_points.eliminations_hit is 'Number of times this season your pick was voted out';
comment on column public.user_season_points.last_week_delta is 'Points from most recently processed episode: +1, -1, or null';
