-- Support double-elimination episodes with a second boot field.
-- Keep medevac_player_id for injury/removal semantics.

alter table public.episodes
  add column if not exists second_voted_out_player_id text;

comment on column public.episodes.second_voted_out_player_id is
  'Optional second voted-out player for double-elimination episodes.';

