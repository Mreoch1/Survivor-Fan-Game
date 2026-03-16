-- Episode 4 Season 50: "Knife to the Heart" — Wed Mar 18 2026 8:00 PM ET (picks lock at episode start)
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 4, '2026-03-18 20:00:00-05')
on conflict (season, episode_number) do update set
  vote_out_lock_at = excluded.vote_out_lock_at,
  updated_at = now();
