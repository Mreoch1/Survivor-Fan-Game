-- Unlock week 1 picks so new users can submit winner, tribe immunity, and vote-out picks for episode 1.
-- Sets episode 1 lock to a future time (e.g. Sunday after week 1 airs). Adjust the timestamp if needed.

update public.episodes
set vote_out_lock_at = '2026-03-08 00:00:00-05',
    updated_at = now()
where season = 50 and episode_number = 1;
