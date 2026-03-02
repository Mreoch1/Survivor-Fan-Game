-- Support for medevac/injury: same as voted out for winner-pick survival (user gets -1 and must repick).
-- Vote-out pick points still only for voted_out_player_id.

alter table public.episodes
  add column if not exists medevac_player_id text;

comment on column public.episodes.medevac_player_id is 'Player medically evacuated or removed this episode; same survival/repick as voted out. Vote-out points only for voted_out_player_id.';

-- Episode 1: Kyle Fraser medevac (ruptured Achilles before tribal)
update public.episodes
set medevac_player_id = 'kyle-fraser', updated_at = now()
where season = 50 and episode_number = 1;
