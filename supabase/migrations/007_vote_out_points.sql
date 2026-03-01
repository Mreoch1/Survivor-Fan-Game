-- Vote-out pick scoring: +N points per episode when you correctly pick who gets voted out

alter table public.user_season_points
  add column if not exists vote_out_points int not null default 0;

comment on column public.user_season_points.vote_out_points is 'Points from correct vote-out picks (who gets voted out this episode). Awarded in process-episode.';
