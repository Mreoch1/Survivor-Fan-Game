-- Episode 7 Season 50: lock should be Wed Apr 8 2026 8:00 PM ET (not Apr 15).
-- Aligns with the week Episode 6 results / next picks; 029 had the wrong date.

update public.episodes
set
  vote_out_lock_at = '2026-04-08 20:00:00-05',
  updated_at = now()
where season = 50
  and episode_number = 7;
