-- Episode 11 Season 50 results + Episode 12 unlock
-- Double tribal: Emily (Group A) and Ozzy (Group B) voted out; Jonathan won individual immunity.

update public.episodes
set
  voted_out_player_id = 'emily-flippen',
  second_voted_out_player_id = 'ozzy-lusth',
  third_voted_out_player_id = null,
  medevac_player_id = null,
  immunity_winning_player_id = 'jonathan-young',
  updated_at = now()
where season = 50
  and episode_number = 11;

delete from public.episode_immunity_tribes
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 11
);

delete from public.episode_points_processed
where episode_id = (
  select id from public.episodes where season = 50 and episode_number = 11
);

insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 12, '2026-05-20 20:00:00-04')
on conflict (season, episode_number) do update set
  vote_out_lock_at = excluded.vote_out_lock_at,
  updated_at = now();
