-- Triple-elimination episodes (e.g. merge "Blood Moon"): third voted-out player.

alter table public.episodes
  add column if not exists third_voted_out_player_id text;

comment on column public.episodes.third_voted_out_player_id is
  'Optional third voted-out player for triple-elimination episodes.';
