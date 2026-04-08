-- Episode 7 Season 50: insert next picks week
-- Wed Apr 8 2026 8:00 PM ET (picks lock at episode start; same week pattern as ep 6 advance)

insert into public.episodes (season, episode_number, vote_out_lock_at)
values (50, 7, '2026-04-08 20:00:00-05')
on conflict (season, episode_number) do update set
  vote_out_lock_at = excluded.vote_out_lock_at,
  updated_at = now();
