-- Unlock Episode 10 picks: previous lock time has passed.
-- Set lock to Wednesday 8 PM ET so users can submit or change picks until then.

update public.episodes
set
  vote_out_lock_at = '2026-05-06 20:00:00-04',
  updated_at = now()
where season = 50
  and episode_number = 10;
