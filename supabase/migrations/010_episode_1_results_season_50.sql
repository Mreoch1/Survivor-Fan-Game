-- Episode 1 Season 50 results (premiere Feb 25 2026)
-- Voted out: Jenna Lewis-Dougherty (Tribal Council)
-- Immunity: Vatu (tribe)
-- After running this migration, go to Dashboard → Admin and click "Process episode" for Episode 1 to update the leaderboard.

update public.episodes
set
  voted_out_player_id = 'jenna-lewis-dougherty',
  immunity_winning_tribe_id = 'vatu',
  updated_at = now()
where season = 50 and episode_number = 1;
