-- Unlock Episode 6 picks: previous lock (2026-04-01) has passed.
-- Set lock to next Wednesday 8 PM ET so users can submit or change picks until then.

update public.episodes
set
  vote_out_lock_at = '2026-04-08 20:00:00-05',
  updated_at = now()
where season = 50 and episode_number = 6;
