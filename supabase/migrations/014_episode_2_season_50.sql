-- Episode 2 Season 50: "Therapy Carousel" — Wed Mar 4 2026 8:00 PM ET (picks lock at episode start)
insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 2, '2026-03-04 20:00:00-05')
on conflict (season, episode_number) do update set
  vote_out_lock_at = excluded.vote_out_lock_at,
  updated_at = now();
